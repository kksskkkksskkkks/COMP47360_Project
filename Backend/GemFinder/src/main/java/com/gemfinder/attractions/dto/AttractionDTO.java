package com.gemfinder.attractions.dto;

import lombok.Data;

import java.time.Instant;

@Data
public class AttractionDTO {

    private Long id;
    private String osmId;
    private String name;
    private String category;
    private String osmGroup;
    private Double lat;
    private Double lon;
    private String openingHours;
    private String openingHoursSource;
    private Integer wheelchair;

    // Merged avg rating (original + user ratings)
    private Double avgRating;
    private Integer ratingCount;

    // Original values from OSM/Google import
    private Double originalAvgRating;
    private Integer originalRatingCount;

    private Integer zoneId;
    private Integer suggestedDurationMin;
    private String imagePath;
    private String imageSource;
    private Boolean imageIsFallback;
    private Instant createdAt;
    private Instant updatedAt;
}