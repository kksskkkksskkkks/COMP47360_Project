package com.gemfinder.heat_map_attraction.mapper;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;
import com.gemfinder.heat_map_attraction.dto.HeatMapAttractionPointDTO;
import org.springframework.stereotype.Component;

@Component
public class HeatMapAttractionMapper {

    /**
     * Maps an Attraction entity to a HeatMapAttractionPointDTO.
     * Business logic (isOpen, busyness) is applied separately by the service layer.
     */
    public HeatMapAttractionPointDTO toDTO(Attraction a) {
        HeatMapAttractionPointDTO dto = new HeatMapAttractionPointDTO();
        dto.setId(a.getId());
        dto.setName(a.getName());
        dto.setCategory(a.getCategory());
        dto.setLat(a.getLat());
        dto.setLon(a.getLon());
        dto.setZoneId(a.getZoneId());
        dto.setOpeningHours(a.getOpeningHours());
        dto.setAvgRating(a.getAvgRating());
        dto.setImagePath(a.getImagePath());
        return dto;
    }

    /**
     * Applies busyness forecast data to the DTO.
     * No-op if forecast is null (zone has no prediction data).
     */
    public void applyForecast(HeatMapAttractionPointDTO dto, BusynessForecastDTO forecast) {
        if (forecast == null) return;
        dto.setBusynessLevel(forecast.getBusynessLevel());
        dto.setBusynessLevelRelative(forecast.getBusynessLevelRelative());
    }
}
