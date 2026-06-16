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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationServiceImpl implements RecommendationService {

    private static final int ATTRACTIONS_PER_SLOT = 3;
    private static final int BUSYNESS_THRESHOLD   = 2; // <= 2 = not busy

    private final GemPeriodRepository gemPeriodRepository;
    private final AttractionRepository attractionRepository;
    private final BusynessForecastService busynessForecastService;
    private final JdbcTemplate jdbcTemplate;

    // ── Read: recommendations ──────────────────────────────────────

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
                    .sorted(Comparator.comparingDouble(
                            p -> -p.getAttraction().getAvgRating()))
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

        // 1. Compute 75th percentile of avgRating dynamically
        double ratingThreshold = computeRatingP75();
        log.info("Rating P75 threshold: {}", ratingThreshold);

        // 2. Filter attractions above threshold
        List<Attraction> qualifiedAttractions = attractionRepository.findAll().stream()
                .filter(a -> a.getAvgRating() != null && a.getAvgRating() >= ratingThreshold)
                .toList();
        log.info("Qualified attractions (avgRating >= {}): {}", ratingThreshold, qualifiedAttractions.size());

        // 3. Fetch ALL busyness data in ONE query
        LocalDateTime from = today.atStartOfDay();
        LocalDateTime to   = tomorrow.plusDays(1).atStartOfDay();
        Map<LocalDateTime, Map<Integer, BusynessForecastDTO>> busynessLookup =
                buildBusynessLookup(from, to);

        // 4. Build gem periods — only slots where busynessLevel <= threshold
        List<Object[]> toSave = new ArrayList<>();

        for (LocalDate date : List.of(today, tomorrow)) {
            List<LocalDateTime> slots = generateSlots(date);

            for (LocalDateTime slot : slots) {
                Map<Integer, BusynessForecastDTO> zoneMap =
                        busynessLookup.getOrDefault(slot, Map.of());

                for (Attraction a : qualifiedAttractions) {
                    BusynessForecastDTO forecast = zoneMap.get(a.getZoneId());
                    short busynessLevel = forecast != null ? forecast.getBusynessLevel() : 3;

                    // Only store slots where the attraction is not busy
                    if (busynessLevel <= BUSYNESS_THRESHOLD) {
                        toSave.add(new Object[]{
                                a.getId(),
                                slot,
                                slot.plusMinutes(30),
                                busynessLevel,
                                forecast != null ? forecast.getPredictedDropoffs() : 0.0,
                                date
                        });
                    }
                }
            }
        }

        log.info("Gem periods to upsert: {}", toSave.size());

        // 5. Batch upsert
        String sql = """
                INSERT INTO gem_periods
                    (attraction_id, start_time, end_time, busyness_level,
                     predicted_dropoffs, forecast_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    busyness_level     = VALUES(busyness_level),
                    predicted_dropoffs = VALUES(predicted_dropoffs),
                    forecast_date      = VALUES(forecast_date)
                """;

        jdbcTemplate.batchUpdate(sql, toSave, 500, (ps, row) -> {
            ps.setLong(1,   (Long)          row[0]);
            ps.setObject(2,                 row[1]); // start_time
            ps.setObject(3,                 row[2]); // end_time
            ps.setShort(4,  (Short)         row[3]);
            ps.setDouble(5, (Double)        row[4]);
            ps.setObject(6,                 row[5]); // forecast_date
        });

        log.info("Upserted {} gem periods for {} and {}", toSave.size(), today, tomorrow);

        // 6. Delete old gem periods that no longer qualify
        //    (attraction may have dropped below P75 threshold)
        gemPeriodRepository.deleteByForecastDateBefore(today);
        log.info("Deleted stale gem periods before {}", today);
    }

    // ── Private helpers ────────────────────────────────────────────

    /** Computes the 75th percentile of avgRating across all attractions. */
    private double computeRatingP75() {
        List<Double> ratings = attractionRepository.findAll().stream()
                .map(Attraction::getAvgRating)
                .filter(Objects::nonNull)
                .sorted()
                .toList();

        if (ratings.isEmpty()) return 0.0;
        int index = (int) Math.ceil(ratings.size() * 0.75) - 1;
        return ratings.get(Math.min(index, ratings.size() - 1));
    }

    private Map<LocalDateTime, Map<Integer, BusynessForecastDTO>> buildBusynessLookup(
            LocalDateTime from, LocalDateTime to) {
        List<BusynessForecastDTO> forecasts = busynessForecastService.getAllZonesInRange(from, to);
        Map<LocalDateTime, Map<Integer, BusynessForecastDTO>> lookup = new HashMap<>();
        for (BusynessForecastDTO f : forecasts) {
            lookup.computeIfAbsent(f.getTimeBucket(), k -> new HashMap<>())
                    .put(f.getZoneId(), f);
        }
        return lookup;
    }

    private List<GemPeriod> fetchPeriods(LocalDate today, LocalDate tomorrow,
                                         List<String> categories, Integer wheelchair) {
        List<LocalDate> dates = List.of(today, tomorrow);

        if (categories != null && !categories.isEmpty() && wheelchair != null) {
            return gemPeriodRepository.findByForecastDatesAndCategoriesAndWheelchair(
                    dates, categories, wheelchair);
        } else if (categories != null && !categories.isEmpty()) {
            return gemPeriodRepository.findByForecastDatesAndCategories(dates, categories);
        } else if (wheelchair != null) {
            return gemPeriodRepository.findByForecastDatesAndWheelchair(dates, wheelchair);
        } else {
            return gemPeriodRepository.findByForecastDatesOrderByStartTimeAscAvgRatingDesc(dates);
        }
    }

    private List<LocalDateTime> generateSlots(LocalDate date) {
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
        dto.setPredictedDropoffs(p.getPredictedDropoffs());
        return dto;
    }
}