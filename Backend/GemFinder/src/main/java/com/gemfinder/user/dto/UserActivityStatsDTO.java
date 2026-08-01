package com.gemfinder.user.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserActivityStatsDTO {

    private Long userId;

    // Total number of attractions the user has favorited
    private long favoriteCount;

    // Total number of ratings the user has submitted
    private long ratingCount;

    // Number of DISTINCT attractions the user has checked in at
    // (repeat checkins at the same attraction are not counted twice)
    private long visitedPlaceCount;
}
