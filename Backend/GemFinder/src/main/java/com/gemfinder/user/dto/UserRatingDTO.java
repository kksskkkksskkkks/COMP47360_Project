package com.gemfinder.user.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
public class UserRatingDTO {

    private Long id;
    private Long userId;
    private Long attractionId;
    private BigDecimal rating;
    private Instant createdAt;
    private Instant updatedAt;
}
