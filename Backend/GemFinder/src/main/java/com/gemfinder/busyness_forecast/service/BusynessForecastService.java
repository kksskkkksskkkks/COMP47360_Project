package com.gemfinder.busyness_forecast.service;

import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;

import java.time.LocalDateTime;
import java.util.List;

public interface BusynessForecastService {

    /**
     * Returns busyness forecast for a single zone at a specific time slot.
     * Checks DB first; falls back to Flask real-time inference if not found.
     */
    BusynessForecastDTO getForecast(Integer zoneId, LocalDateTime timeBucket);

//    /**
//     * Returns the 48-hour forecast for a zone starting from now.
//     * All slots come from DB (populated nightly by Predict.py).
//     */
//    List<BusynessForecastDTO> getForecast48h(Integer zoneId);


    List<BusynessForecastDTO> getForecastRange(Integer zoneId, LocalDateTime from, LocalDateTime to);

    /**
     * Returns busyness levels for all zones at a given time slot.
     * Used for rendering the heatmap snapshot.
     */
    List<BusynessForecastDTO> getAllZonesAtTime(LocalDateTime timeBucket);

    /**
     * Returns busyness forecasts for all zones within a time range.
     * Used by generateAndSave() to batch-fetch data and avoid N+1 queries.
     */
    List<BusynessForecastDTO> getAllZonesInRange(LocalDateTime from, LocalDateTime to);
}
