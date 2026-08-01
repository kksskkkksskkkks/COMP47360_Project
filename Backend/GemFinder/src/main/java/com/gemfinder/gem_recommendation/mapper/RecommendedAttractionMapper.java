package com.gemfinder.gem_recommendation.mapper;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.gem_recommendation.dto.RecommendedAttractionDTO;
import com.gemfinder.gem_recommendation.entity.GemPeriod;
import com.gemfinder.util.OpeningHoursUtil;

public class RecommendedAttractionMapper {

    private RecommendedAttractionMapper() {}

    public static RecommendedAttractionDTO toDTO(GemPeriod p) {
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