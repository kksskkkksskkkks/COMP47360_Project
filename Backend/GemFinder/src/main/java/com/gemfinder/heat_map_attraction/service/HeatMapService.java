package com.gemfinder.heat_map_attraction.service;

import com.gemfinder.heat_map_attraction.dto.HeatMapAttractionPointDTO;

import java.time.LocalDateTime;
import java.util.List;

public interface HeatMapService {

    /**
     * Returns all attractions enriched with busyness data at the given time slot.
     * Used by the frontend map with time slider.
     *
     * @param timeBucket the time slot to query busyness for (rounded to 30min internally)
     */
    List<HeatMapAttractionPointDTO> getMapPoints(LocalDateTime timeBucket);
}
