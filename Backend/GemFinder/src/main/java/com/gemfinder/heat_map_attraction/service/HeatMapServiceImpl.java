package com.gemfinder.heat_map_attraction.service;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;
import com.gemfinder.busyness_forecast.service.BusynessForecastService;
import com.gemfinder.heat_map_attraction.dto.HeatMapAttractionPointDTO;
import com.gemfinder.heat_map_attraction.service.HeatMapService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class HeatMapServiceImpl implements HeatMapService {

    private final AttractionRepository attractionRepository;
    private final BusynessForecastService busynessForecastService;

    @Override
    @Transactional(readOnly = true)
    public List<HeatMapAttractionPointDTO> getMapPoints(LocalDateTime timeBucket) {
        // 1. Fetch all attractions
        List<Attraction> attractions = attractionRepository.findAll();

        // 2. Fetch busyness for all zones at this time slot in one query
        List<BusynessForecastDTO> forecasts =
                busynessForecastService.getAllZonesAtTime(timeBucket);

        // Build zone → forecast lookup map
        Map<Integer, BusynessForecastDTO> forecastByZone = forecasts.stream()
                .collect(Collectors.toMap(BusynessForecastDTO::getZoneId, f -> f));

        // 3. Merge and return
        return attractions.stream()
                .map(a -> toDTO(a, timeBucket, forecastByZone.get(a.getZoneId())))
                .toList();
    }

    // ── Private helpers ────────────────────────────────────────────

    private HeatMapAttractionPointDTO toDTO(Attraction a,
                                        LocalDateTime timeBucket,
                                        BusynessForecastDTO forecast) {
        HeatMapAttractionPointDTO dto = new HeatMapAttractionPointDTO();
        dto.setId(a.getId());
        dto.setName(a.getName());
        dto.setCategory(a.getCategory());
        dto.setLat(a.getLat());
        dto.setLon(a.getLon());
        dto.setZoneId(a.getZoneId());
        dto.setOpeningHours(a.getOpeningHours());
        dto.setIsOpen(isOpen(a.getOpeningHours(), timeBucket));
        dto.setAvgRating(a.getAvgRating());
        dto.setImagePath(a.getImagePath());

        if (forecast != null) {
            dto.setBusynessLevel(forecast.getBusynessLevel());
            dto.setBusynessLevelRelative(forecast.getBusynessLevelRelative());
        }

        return dto;
    }

    /**
     * Parses opening hours string and checks if the attraction is open at the given time.
     * Supported formats:
     *   - "24/7"           → always open
     *   - "HH:mm-HH:mm"   → simple daily range
     * Returns null if format is unknown (frontend treats as unknown).
     */
    private Boolean isOpen(String openingHours, LocalDateTime time) {
        if (openingHours == null || openingHours.isBlank()) {
            return null;
        }

        String normalized = openingHours.trim().toLowerCase();

        // 24/7 — always open
        if (normalized.equals("24/7") || normalized.equals("always open")) {
            return true;
        }

        try {
            // Handle basic "HH:mm-HH:mm" format
            String[] parts = normalized.split("-");
            if (parts.length != 2) return null;

            String[] open  = parts[0].trim().split(":");
            String[] close = parts[1].trim().split(":");

            int openMinutes  = Integer.parseInt(open[0])  * 60 + Integer.parseInt(open[1]);
            int closeMinutes = Integer.parseInt(close[0]) * 60 + Integer.parseInt(close[1]);
            int nowMinutes   = time.getHour() * 60 + time.getMinute();

            // Handle overnight ranges e.g. "22:00-02:00"
            if (closeMinutes < openMinutes) {
                return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
            }

            return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
        } catch (Exception e) {
            log.debug("Could not parse opening hours '{}': {}", openingHours, e.getMessage());
            return null;
        }
    }
}