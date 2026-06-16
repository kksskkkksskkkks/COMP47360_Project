package com.gemfinder.gem_recommendation.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
public class RecommendationSlotDTO {

    private LocalDateTime timeBucket;
    private List<RecommendedAttractionDTO> attractions;
}
