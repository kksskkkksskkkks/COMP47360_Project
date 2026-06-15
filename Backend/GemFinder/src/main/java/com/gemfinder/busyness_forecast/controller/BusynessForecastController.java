package com.gemfinder.busyness_forecast.controller;

import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;
import com.gemfinder.busyness_forecast.service.BusynessForecastService;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/busyness")
@RequiredArgsConstructor
public class BusynessForecastController {

    private final BusynessForecastService busynessForecastService;

    // GET /api/busyness?zoneId=1&timeBucket=2026-06-15T14:00:00
    // Single slot — DB first, Flask fallback
    @GetMapping
    public BusynessForecastDTO getForecast(
            @RequestParam Integer zoneId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime timeBucket) {
        return busynessForecastService.getForecast(zoneId, timeBucket);
    }

//    // GET /api/busyness/{zoneId}/48h
//    // Full 48-hour forecast for a zone (from DB)
//    @GetMapping("/{zoneId}/48h")
//    public List<BusynessForecastDTO> getForecast48h(@PathVariable Integer zoneId) {
//        return busynessForecastService.getForecast48h(zoneId);
//    }

    // GET /api/busyness/{zoneId}/forecast?from=2026-06-15T00:00:00&to=2026-06-17T00:00:00
    @GetMapping("/{zoneId}/forecast")
    public ApiResponse<List<BusynessForecastDTO>> getForecastRange(
            @PathVariable Integer zoneId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return ApiResponse.success(busynessForecastService.getForecastRange(zoneId, from, to));
    }



    // GET /api/busyness/snapshot?timeBucket=2026-06-15T14:00:00
    // All zones at a given time (for heatmap rendering)
    @GetMapping("/snapshot")
    public List<BusynessForecastDTO> getAllZonesAtTime(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime timeBucket) {
        return busynessForecastService.getAllZonesAtTime(timeBucket);
    }
}
