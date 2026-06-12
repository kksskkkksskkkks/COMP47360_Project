package com.gemfinder.attractions.mapper;

import com.gemfinder.attractions.dto.AttractionDTO;
import com.gemfinder.attractions.entity.Attraction;

public class AttractionMapper {

    private AttractionMapper() {}

    public static AttractionDTO toDTO(Attraction e) {
        AttractionDTO dto = new AttractionDTO();
        dto.setId(e.getId());
        dto.setOsmId(e.getOsmId());
        dto.setName(e.getName());
        dto.setCategory(e.getCategory());
        dto.setOsmGroup(e.getOsmGroup());
        dto.setLat(e.getLat());
        dto.setLon(e.getLon());
        dto.setOpeningHours(e.getOpeningHours());
        dto.setOpeningHoursSource(e.getOpeningHoursSource());
        dto.setWheelchair(e.getWheelchair());
        dto.setAvgRating(e.getAvgRating());
        dto.setRatingCount(e.getRatingCount());
        dto.setZoneId(e.getZoneId());
        dto.setSuggestedDurationMin(e.getSuggestedDurationMin());
        dto.setImagePath(e.getImagePath());
        dto.setImageSource(e.getImageSource());
        dto.setImageIsFallback(e.getImageIsFallback());
        dto.setCreatedAt(e.getCreatedAt());
        dto.setUpdatedAt(e.getUpdatedAt());
        return dto;
    }
}
