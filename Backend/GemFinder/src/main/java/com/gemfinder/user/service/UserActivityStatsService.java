package com.gemfinder.user.service;

import com.gemfinder.user.dto.UserActivityStatsDTO;

public interface UserActivityStatsService {

    /**
     * Returns aggregate activity counts for a user:
     * total favorites, total ratings, and distinct attractions checked in
     * (repeat checkins at the same attraction count once).
     * Throws 404 if the user does not exist.
     */
    UserActivityStatsDTO getStats(Long userId);
}
