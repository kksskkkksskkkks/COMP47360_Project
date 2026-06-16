package com.gemfinder.gem_recommendation.controller;

import com.gemfinder.gem_recommendation.dto.RecommendationSlotDTO;
import com.gemfinder.gem_recommendation.service.RecommendationService;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;

    // GET /api/recommendations
    // GET /api/recommendations?categories=Park,Museum
    // GET /api/recommendations?wheelchair=1
    // GET /api/recommendations?categories=Park&wheelchair=2
    @GetMapping
    public ApiResponse<List<RecommendationSlotDTO>> getRecommendations(
            @RequestParam(required = false) List<String> categories,
            @RequestParam(required = false) Integer wheelchair) {
        return ApiResponse.success(recommendationService.getRecommendations(categories, wheelchair));
    }

    // POST /api/recommendations/generate  (manual trigger for testing)
    @PostMapping("/generate")
    public ApiResponse<Void> generate() {
        recommendationService.generateAndSave();
        return ApiResponse.success(null);
    }
}