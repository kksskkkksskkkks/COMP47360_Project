package com.gemfinder.gem_recommendation.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class AttractionBusynessSlotDTO {

    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Double predictedDropoffs;
    private Short busynessLevel;
    private Boolean isGem; // true = high rating + low busyness (highlighted on chart)
}
