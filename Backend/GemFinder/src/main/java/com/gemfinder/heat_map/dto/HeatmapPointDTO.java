package com.gemfinder.heat_map.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class HeatmapPointDTO {

    private Double lat;
    private Double lon;
    private Long checkinCount;
}