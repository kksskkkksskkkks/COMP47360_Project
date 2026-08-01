package com.gemfinder.busyness_forecast.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class BusynessForecastDTO {

    private Integer zoneId;
    private LocalDateTime timeBucket;
    private Double predictedDropoffs;
    private Short busynessLevel;
    private Short busynessLevelRelative;
    private Double temperature2m;
    private Double precipitation;
    private Short weathercode;
    private Double windspeed10m;
    private LocalDateTime updatedAt;
}
