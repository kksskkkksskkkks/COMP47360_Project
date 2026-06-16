package com.gemfinder.gem_recommendation.service;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;
import com.gemfinder.busyness_forecast.service.BusynessForecastService;
import com.gemfinder.gem_recommendation.dto.RecommendationSlotDTO;
import com.gemfinder.gem_recommendation.dto.RecommendedAttractionDTO;
import com.gemfinder.gem_recommendation.entity.GemPeriod;
import com.gemfinder.gem_recommendation.repository.GemPeriodRepository;
import com.gemfinder.gem_recommendation.service.RecommendationService;
import com.gemfinder.util.OpeningHoursUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationServiceImpl implements RecommendationService {

    private static final int ATTRACTIONS_PER_SLOT = 3;

    private final GemPeriodRepository gemPeriodRepository;
    private final AttractionRepository attractionRepository;
    private final BusynessForecastService busynessForecastService;
    private final JdbcTemplate jdbcTemplate;

    // ── Read: return recommendations ───────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<RecommendationSlotDTO> getRecommendations(List<String> categories,
                                                          Integer wheelchair) {
        LocalDate today    = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);

        List<GemPeriod> periods = fetchPeriods(today, tomorrow, categories, wheelchair);

        Map<LocalDateTime, List<GemPeriod>> bySlot = periods.stream()
                .collect(Collectors.groupingBy(GemPeriod::getStartTime,
                        LinkedHashMap::new, Collectors.toList()));

        Set<Long> usedIds = new HashSet<>();
        List<RecommendationSlotDTO> result = new ArrayList<>();

        for (Map.Entry<LocalDateTime, List<GemPeriod>> entry : bySlot.entrySet()) {
            LocalDateTime slot = entry.getKey();

            List<RecommendedAttractionDTO> picked = entry.getValue().stream()
                    .filter(p -> !usedIds.contains(p.getAttraction().getId()))
                    .filter(p -> {
                        Boolean open = OpeningHoursUtil.isOpen(p.getAttraction().getOpeningHours(), slot);
                        return open == null || open;
                    })
                    .sorted(Comparator.comparing(GemPeriod::getGemScore).reversed())
                    .limit(ATTRACTIONS_PER_SLOT)
                    .map(this::toDTO)
                    .toList();

            picked.forEach(a -> usedIds.add(a.getId()));
            result.add(new RecommendationSlotDTO(slot, picked));
        }

        return result;
    }

    // ── Write: generate and persist gem periods ────────────────────

    @Override
    public void generateAndSave() {
        log.info("Generating gem periods...");

        LocalDate today    = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);

        List<Attraction> attractions = attractionRepository.findAll();

        // Fetch ALL busyness data in ONE query — always cover full day from midnight
        LocalDateTime from = today.atStartOfDay();
        LocalDateTime to   = tomorrow.plusDays(1).atStartOfDay();

        Map<LocalDateTime, Map<Integer, Short>> busynessLookup = buildBusynessLookup(from, to);

        List<GemPeriod> toSave = new ArrayList<>();

        for (LocalDate date : List.of(today, tomorrow)) {
            List<LocalDateTime> slots = generateSlots(date);

            for (LocalDateTime slot : slots) {
                Map<Integer, Short> zoneMap = busynessLookup.getOrDefault(slot, Map.of());

                for (Attraction a : attractions) {
                    short busynessLevel  = zoneMap.getOrDefault(a.getZoneId(), (short) 3);
                    double avgRating     = a.getAvgRating() != null ? a.getAvgRating() : 0.0;
                    double ratingScore   = avgRating / 5.0;
                    double busynessScore = (6.0 - busynessLevel) / 5.0;
                    double finalScore    = (ratingScore + busynessScore) / 2.0;

                    GemPeriod period = new GemPeriod();
                    period.setAttraction(a);
                    period.setStartTime(slot);
                    period.setEndTime(slot.plusMinutes(30));
                    period.setBusynessLevel(busynessLevel);
                    period.setGemScore(BigDecimal.valueOf(finalScore).setScale(2, RoundingMode.HALF_UP));
                    period.setForecastDate(date);
                    toSave.add(period);
                }
            }
        }

        // Batch upsert via JDBC — much faster than per-row JPA calls
        String sql = """
                INSERT INTO gem_periods
                    (attraction_id, start_time, end_time, busyness_level, gem_score, forecast_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    busyness_level = VALUES(busyness_level),
                    gem_score      = VALUES(gem_score),
                    forecast_date  = VALUES(forecast_date)
                """;

        jdbcTemplate.batchUpdate(sql, toSave, 500, (ps, period) -> {
            ps.setLong(1, period.getAttraction().getId());
            ps.setObject(2, period.getStartTime());
            ps.setObject(3, period.getEndTime());
            ps.setShort(4, period.getBusynessLevel());
            ps.setBigDecimal(5, period.getGemScore());
            ps.setObject(6, period.getForecastDate());
        });

        log.info("Upserted {} gem periods for {} and {}", toSave.size(), today, tomorrow);

        // Only delete data older than yesterday
        gemPeriodRepository.deleteByForecastDateBefore(today);
        log.info("Deleted stale gem periods before {}", today);
    }

    // ── Private helpers ────────────────────────────────────────────

    private Map<LocalDateTime, Map<Integer, Short>> buildBusynessLookup(LocalDateTime from,
                                                                        LocalDateTime to) {
        List<BusynessForecastDTO> forecasts = busynessForecastService.getAllZonesInRange(from, to);
        Map<LocalDateTime, Map<Integer, Short>> lookup = new HashMap<>();
        for (BusynessForecastDTO f : forecasts) {
            lookup.computeIfAbsent(f.getTimeBucket(), k -> new HashMap<>())
                    .put(f.getZoneId(), f.getBusynessLevel());
        }
        return lookup;
    }

    private List<GemPeriod> fetchPeriods(LocalDate today, LocalDate tomorrow,
                                         List<String> categories, Integer wheelchair) {
        List<GemPeriod> result = new ArrayList<>();
        for (LocalDate date : List.of(today, tomorrow)) {
            if (categories != null && !categories.isEmpty() && wheelchair != null) {
                result.addAll(gemPeriodRepository
                        .findByForecastDateAndCategoriesAndWheelchair(date, categories, wheelchair));
            } else if (categories != null && !categories.isEmpty()) {
                result.addAll(gemPeriodRepository
                        .findByForecastDateAndCategories(date, categories));
            } else if (wheelchair != null) {
                result.addAll(gemPeriodRepository
                        .findByForecastDateAndWheelchair(date, wheelchair));
            } else {
                result.addAll(gemPeriodRepository
                        .findByForecastDateOrderByStartTimeAscGemScoreDesc(date));
            }
        }
        return result;
    }

    private List<LocalDateTime> generateSlots(LocalDate date) {
        // Always generate full day from midnight — frontend filters past slots on display
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end   = date.plusDays(1).atStartOfDay();

        List<LocalDateTime> slots = new ArrayList<>();
        LocalDateTime cursor = start;
        while (cursor.isBefore(end)) {
            slots.add(cursor);
            cursor = cursor.plusMinutes(30);
        }
        return slots;
    }

    private RecommendedAttractionDTO toDTO(GemPeriod p) {
        Attraction a = p.getAttraction();
        RecommendedAttractionDTO dto = new RecommendedAttractionDTO();
        dto.setId(a.getId());
        dto.setName(a.getName());
        dto.setCategory(a.getCategory());
        dto.setLat(a.getLat());
        dto.setLon(a.getLon());
        dto.setZoneId(a.getZoneId());
        dto.setOpeningHours(a.getOpeningHours());
        dto.setIsOpen(OpeningHoursUtil.isOpen(a.getOpeningHours(), p.getStartTime()));
        dto.setAvgRating(a.getAvgRating());
        dto.setImagePath(a.getImagePath());
        dto.setWheelchair(a.getWheelchair());
        dto.setBusynessLevel(p.getBusynessLevel());
        dto.setGemScore(p.getGemScore());
        return dto;
    }
}