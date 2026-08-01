package com.gemfinder.gem_recommendation.controller;

import com.gemfinder.gem_recommendation.dto.RecommendationSlotDTO;
import com.gemfinder.gem_recommendation.service.RecommendationService;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;

    @Value("${gemfinder.internal.secret}")
    private String internalSecret;

    @GetMapping
    public ApiResponse<List<RecommendationSlotDTO>> getRecommendations(
            @RequestParam(required = false) List<String> categories,
            @RequestParam(required = false) Integer wheelchair) {
        return ApiResponse.success(recommendationService.getRecommendations(categories, wheelchair));
    }

    @PostMapping("/generate")
    public ApiResponse<Void> generate(
            @RequestHeader("X-Internal-Secret") String secret) {
        if (!internalSecret.equals(secret)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        recommendationService.generateAndSave();
        return ApiResponse.success(null);
    }
}