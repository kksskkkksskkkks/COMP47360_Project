package com.gemfinder.gem_recommendation.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class RecommendedAttractionDTO {

    private Long id;
    private String name;
    private String category;
    private Double lat;
    private Double lon;
    private Integer zoneId;
    private String openingHours;
    private Boolean isOpen;
    private Double avgRating;
    private String imagePath;
    private Integer wheelchair;
    private Short busynessLevel;
    private BigDecimal gemScore;
}
