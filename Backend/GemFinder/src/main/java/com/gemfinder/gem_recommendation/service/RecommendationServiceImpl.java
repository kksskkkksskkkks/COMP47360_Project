package com.gemfinder.gem_recommendation.service;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;
import com.gemfinder.busyness_forecast.service.BusynessForecastService;
import com.gemfinder.gem_recommendation.dto.RecommendationSlotDTO;
import com.gemfinder.gem_recommendation.dto.RecommendedAttractionDTO;
import com.gemfinder.gem_recommendation.entity.GemPeriod;
import com.gemfinder.gem_recommendation.mapper.RecommendedAttractionMapper;
import com.gemfinder.gem_recommendation.repository.GemPeriodRepository;
import com.gemfinder.gem_recommendation.service.RecommendationService;
import com.gemfinder.util.OpeningHoursUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
                    .map(RecommendedAttractionMapper::toDTO)
                    .toList();

            picked.forEach(a -> usedIds.add(a.getId()));
            result.add(new RecommendationSlotDTO(slot, picked));
        }

        return result;
    }

    // ── Write: generate and persist gem periods ────────────────────

    @Override
    @Transactional
    public void generateAndSave() {
        log.info("Generating gem periods...");

        LocalDate today    = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);

        // Delete today and tomorrow's existing data before regenerating
        gemPeriodRepository.deleteByForecastDateBefore(tomorrow.plusDays(1));
        log.info("Deleted existing gem periods for {} and {}", today, tomorrow);

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
        List<GemPeriod> toSave = new ArrayList<>();

        for (LocalDate date : List.of(today, tomorrow)) {
            List<LocalDateTime> slots = generateSlots(date);

            for (LocalDateTime slot : slots) {
                Map<Integer, BusynessForecastDTO> zoneMap =
                        busynessLookup.getOrDefault(slot, Map.of());

                for (Attraction a : qualifiedAttractions) {
                    BusynessForecastDTO forecast = zoneMap.get(a.getZoneId());
                    short busynessLevel = forecast != null ? forecast.getBusynessLevel() : 3;

                    if (busynessLevel <= BUSYNESS_THRESHOLD) {
                        GemPeriod period = new GemPeriod();
                        period.setAttraction(a);
                        period.setStartTime(slot);
                        period.setBusynessLevel(busynessLevel);
                        period.setPredictedDropoffs(forecast != null ? forecast.getPredictedDropoffs() : 0.0);
                        period.setForecastDate(date);
                        toSave.add(period);
                    }
                }
            }
        }

        log.info("Gem periods to save: {}", toSave.size());
        gemPeriodRepository.saveAll(toSave);
        log.info("Saved {} gem periods for {} and {}", toSave.size(), today, tomorrow);

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
}