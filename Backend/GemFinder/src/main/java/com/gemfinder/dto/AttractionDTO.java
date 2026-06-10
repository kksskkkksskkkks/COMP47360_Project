package com.gemfinder.dto;

import lombok.Data;

/**
 * Response body for both the attraction list endpoint and the detail endpoint.
 * Omits internal fields (osm_id, image_is_fallback, etc.) that the frontend
 * does not need.
 */
@Data
public class AttractionDTO {

    private Long    id;
    private String  name;
    private String  category;
    private Float   lat;
    private Float   lon;
    private String  openingHours;
    private Integer wheelchair;
    private Float   avgRating;
    private Integer ratingCount;
    private Integer zoneId;
    private Integer suggestedDurationMin;
    private String  imagePath;

    // Busyness data injected by AttractionService after calling Flask.
    // Null when the forecast is unavailable.
    private Integer busynessLevel;
    private Integer busynessLevelRelative;
}
