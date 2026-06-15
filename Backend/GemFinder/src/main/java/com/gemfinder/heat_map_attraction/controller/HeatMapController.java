package com.gemfinder.heat_map_attraction.controller;

import com.gemfinder.heat_map_attraction.dto.HeatMapAttractionPointDTO;
import com.gemfinder.heat_map_attraction.service.HeatMapService;
import com.gemfinder.heat_map_attraction.dto.HeatMapAttractionPointDTO;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
public class HeatMapController {

    private final HeatMapService heatMapService;

    // GET /api/map/attractions?timeBucket=2026-06-15T14:00:00
    @GetMapping("/attractions")
    public ApiResponse<List<HeatMapAttractionPointDTO>> getMapPoints(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime timeBucket) {
        return ApiResponse.success(heatMapService.getMapPoints(timeBucket));
    }
}
