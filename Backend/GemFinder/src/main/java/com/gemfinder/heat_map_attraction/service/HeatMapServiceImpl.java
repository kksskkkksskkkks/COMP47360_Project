package com.gemfinder.heat_map_attraction.service;

import ch.poole.openinghoursparser.OpeningHoursParser;
import ch.poole.openinghoursparser.Rule;
import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;
import com.gemfinder.busyness_forecast.service.BusynessForecastService;
import com.gemfinder.heat_map_attraction.dto.HeatMapAttractionPointDTO;
import com.gemfinder.heat_map_attraction.mapper.HeatMapAttractionMapper;
import io.leonard.OpeningHoursEvaluator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
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
    private final HeatMapAttractionMapper heatMapAttractionMapper;

    @Override
    @Transactional(readOnly = true)
    public List<HeatMapAttractionPointDTO> getMapPoints(LocalDateTime timeBucket) {
        List<Attraction> attractions = attractionRepository.findAll();

        // Fetch busyness forecasts for all zones and index by zoneId for O(1) lookup
        Map<Integer, BusynessForecastDTO> forecastByZone =
                busynessForecastService.getAllZonesAtTime(timeBucket)
                        .stream()
                        .collect(Collectors.toMap(BusynessForecastDTO::getZoneId, f -> f));

        return attractions.stream()
                .map(a -> buildDTO(a, timeBucket, forecastByZone.get(a.getZoneId())))
                .toList();
    }

    // ── Private helpers ───────────────────────────────────────────

    /**
     * Assembles a HeatMapAttractionPointDTO by combining field mapping,
     * opening-hours evaluation, and busyness forecast data.
     */
    private HeatMapAttractionPointDTO buildDTO(Attraction a,
                                               LocalDateTime timeBucket,
                                               BusynessForecastDTO forecast) {
        HeatMapAttractionPointDTO dto = heatMapAttractionMapper.toDTO(a);
        dto.setIsOpen(isOpen(a.getOpeningHours(), timeBucket));
        heatMapAttractionMapper.applyForecast(dto, forecast);
        return dto;
    }

    /**
     * Evaluates whether an attraction is open at the given time using
     * the opening-hours-evaluator library (OSM format).
     * Returns null if the string cannot be parsed.
     */
    private Boolean isOpen(String openingHours, LocalDateTime time) {
        if (openingHours == null || openingHours.isBlank()) return null;
        try {
            OpeningHoursParser parser = new OpeningHoursParser(
                    new ByteArrayInputStream(openingHours.getBytes()));
            List<Rule> rules = parser.rules(false); // false = non-strict mode
            return OpeningHoursEvaluator.isOpenAt(time, rules);
        } catch (Exception e) {
            log.debug("Could not parse opening hours '{}': {}", openingHours, e.getMessage());
            return null;
        }
    }
}
