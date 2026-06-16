package com.gemfinder.gem_recommendation.service;

import com.gemfinder.gem_recommendation.dto.AttractionBusynessSlotDTO;

import java.time.LocalDate;
import java.util.List;

public interface AttractionBusynessService {

    /**
     * Returns all 48 half-hour slots for a given attraction and date.
     * Each slot includes predictedDropoffs, busynessLevel and isGem flag.
     * Used by the attraction detail page bar chart.
     */
    List<AttractionBusynessSlotDTO> getSlots(Long attractionId, LocalDate date);
}
