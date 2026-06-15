package com.gemfinder.profile_map.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ProfileMapPointDTO {

    private Long attractionId;
    private Integer zoneId;
    private Double avgRating;
    private String imagePath;
    private Double lat;
    private Double lon;
    private Long checkinCount;
    private String name;
    private String category;
}