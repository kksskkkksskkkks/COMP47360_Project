package com.gemfinder.user.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class CheckinRequest {

    // Optional busyness snapshot at time of visit (0 = empty, 5 = very busy)
    @Min(0) @Max(5)
    private Short busynessAtVisit;
}