package com.gemfinder.gem_recommendation.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class GemPeriodDTO {

    private Long id;
    private Long attractionId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Short busynessLevel;
    private BigDecimal gemScore;
    private LocalDate forecastDate;
    private Instant createdAt;
}
