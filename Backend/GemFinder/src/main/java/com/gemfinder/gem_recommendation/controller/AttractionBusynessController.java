package com.gemfinder.gem_recommendation.controller;

import com.gemfinder.gem_recommendation.dto.AttractionBusynessSlotDTO;
import com.gemfinder.gem_recommendation.service.AttractionBusynessService;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/attractions")
@RequiredArgsConstructor
public class AttractionBusynessController {

    private final AttractionBusynessService attractionBusynessService;

    // GET /api/attractions/{id}/busyness?date=2026-06-16
    // GET /api/attractions/{id}/busyness          ← defaults to today
    @GetMapping("/{id}/busyness")
    public ApiResponse<List<AttractionBusynessSlotDTO>> getSlots(
            @PathVariable Long id,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        if (date == null) date = LocalDate.now();
        return ApiResponse.success(attractionBusynessService.getSlots(id, date));
    }
}
