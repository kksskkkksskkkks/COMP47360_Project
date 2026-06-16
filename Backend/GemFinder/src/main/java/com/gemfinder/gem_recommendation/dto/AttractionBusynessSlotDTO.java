package com.gemfinder.gem_recommendation.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class AttractionBusynessSlotDTO {

    private LocalDateTime startTime;
    private Double predictedDropoffs;
    private Short busynessLevel;
    private Boolean isGem;
    private Boolean isOpen; // null = unknown, true = open, false = closed
}