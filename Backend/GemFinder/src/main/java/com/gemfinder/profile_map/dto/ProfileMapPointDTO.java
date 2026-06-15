package com.gemfinder.profile_map.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ProfileMapPointDTO {

    private Double lat;
    private Double lon;
    private Long checkinCount;
}