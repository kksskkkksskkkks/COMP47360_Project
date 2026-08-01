package com.gemfinder.gem_recommendation.service;

import com.gemfinder.gem_recommendation.dto.RecommendationSlotDTO;

import java.util.List;

public interface RecommendationService {

    /**
     * Returns recommendations from now until end of the next day,
     * grouped by 30-minute slots, 3 attractions per slot.
     * Each attraction appears at most once. Only open attractions are included.
     *
     * @param categories optional category filter (null or empty = all)
     * @param wheelchair optional minimum wheelchair level (null = no filter)
     */
    List<RecommendationSlotDTO> getRecommendations(List<String> categories, Integer wheelchair);

    /**
     * Regenerates and persists gem periods for today + tomorrow.
     * Called by the nightly scheduled task after Predict.py finishes.
     */
    void generateAndSave();
}
