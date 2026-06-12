package com.gemfinder.gem_recommendation.mapper;

import com.gemfinder.gem_recommendation.dto.GemPeriodDTO;
import com.gemfinder.gem_recommendation.entity.GemPeriod;

public class GemPeriodMapper {

    private GemPeriodMapper() {}

    public static GemPeriodDTO toDTO(GemPeriod e) {
        GemPeriodDTO dto = new GemPeriodDTO();
        dto.setId(e.getId());
        dto.setAttractionId(e.getAttraction().getId());
        dto.setStartTime(e.getStartTime());
        dto.setEndTime(e.getEndTime());
        dto.setBusynessLevel(e.getBusynessLevel());
        dto.setGemScore(e.getGemScore());
        dto.setForecastDate(e.getForecastDate());
        dto.setCreatedAt(e.getCreatedAt());
        return dto;
    }
}
