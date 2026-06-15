package com.gemfinder.heat_map_attraction.dto;

import lombok.Data;

@Data
public class HeatMapAttractionPointDTO {

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

    // Busyness from forecast (null if zone not found in DB)
    private Short busynessLevel;
    private Short busynessLevelRelative;
}
