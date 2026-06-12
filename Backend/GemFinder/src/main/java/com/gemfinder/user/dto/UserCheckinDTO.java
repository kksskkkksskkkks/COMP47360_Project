package com.gemfinder.user.dto;

import lombok.Data;

import java.time.Instant;

@Data
public class UserCheckinDTO {

    private Long id;
    private Long userId;
    private Long attractionId;
    private Short busynessAtVisit;
    private Instant visitedAt;
}
