package com.gemfinder.entity;

import lombok.Data;

import java.time.LocalDateTime;




@Data
public class Attraction {

    private Long    id;
    private String  osmId;
    private String  name;
    private String  category;
    private String  osmGroup;
    private Float   lat;
    private Float   lon;
    private String  openingHours;
    private String  openingHoursSource;
    private Integer wheelchair;
    private Float   avgRating;
    private Integer ratingCount;
    private Integer zoneId;
    private Integer suggestedDurationMin;
    private String  imagePath;
    private String  imageSource;
    private Boolean imageIsFallback;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}