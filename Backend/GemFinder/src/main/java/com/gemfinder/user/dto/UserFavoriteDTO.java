package com.gemfinder.user.dto;

import lombok.Data;

import java.time.Instant;

@Data
public class UserFavoriteDTO {

    private Long id;
    private Long userId;
    private Long attractionId;
    private Instant createdAt;
}
