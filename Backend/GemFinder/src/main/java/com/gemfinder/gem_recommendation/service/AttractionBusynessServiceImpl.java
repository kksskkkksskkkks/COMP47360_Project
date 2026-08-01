package com.gemfinder.gem_recommendation.service;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;
import com.gemfinder.busyness_forecast.service.BusynessForecastService;
import com.gemfinder.gem_recommendation.dto.AttractionBusynessSlotDTO;
import com.gemfinder.gem_recommendation.entity.GemPeriod;
import com.gemfinder.gem_recommendation.repository.GemPeriodRepository;
import com.gemfinder.util.OpeningHoursUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttractionBusynessServiceImpl implements AttractionBusynessService {

    private final AttractionRepository attractionRepository;
    private final BusynessForecastService busynessForecastService;
    private final GemPeriodRepository gemPeriodRepository;

    @Override
    @Transactional(readOnly = true)
    public List<AttractionBusynessSlotDTO> getSlots(Long attractionId, LocalDate date) {
        Attraction attraction = attractionRepository.findById(attractionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Attraction not found with id: " + attractionId));

        // Get all gem period start times for this attraction on this date
        Set<LocalDateTime> gemSlots = gemPeriodRepository
                .findByAttractionIdAndDate(attractionId, date)
                .stream()
                .map(GemPeriod::getStartTime)
                .collect(Collectors.toSet());

        // Get busyness forecast for this attraction's zone for the full day
        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to   = date.plusDays(1).atStartOfDay();

        Map<LocalDateTime, BusynessForecastDTO> forecastBySlot =
                busynessForecastService.getAllZonesInRange(from, to)
                        .stream()
                        .filter(f -> f.getZoneId().equals(attraction.getZoneId()))
                        .collect(Collectors.toMap(BusynessForecastDTO::getTimeBucket, f -> f));

        // Build all 48 slots
        List<AttractionBusynessSlotDTO> result = new ArrayList<>();
        LocalDateTime cursor = from;

        while (cursor.isBefore(to)) {
            BusynessForecastDTO forecast = forecastBySlot.get(cursor);
            LocalDateTime finalCursor = cursor;

            result.add(new AttractionBusynessSlotDTO(
                    cursor,
                    forecast != null ? forecast.getPredictedDropoffs() : 0.0,
                    forecast != null ? forecast.getBusynessLevel() : (short) 3,
                    gemSlots.contains(finalCursor),
                    OpeningHoursUtil.isOpen(attraction.getOpeningHours(), cursor)
            ));

            cursor = cursor.plusMinutes(30);
        }

        return result;
    }
}