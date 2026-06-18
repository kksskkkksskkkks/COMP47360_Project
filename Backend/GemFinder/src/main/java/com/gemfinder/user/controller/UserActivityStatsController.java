package com.gemfinder.user_activity_stats.controller;

import com.gemfinder.user.dto.UserActivityStatsDTO;
import com.gemfinder.user.service.UserActivityStatsService;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users/{userId}/activity-stats")
@RequiredArgsConstructor
public class UserActivityStatsController {

    private final UserActivityStatsService userActivityStatsService;

    // GET /api/users/{userId}/activity-stats
    @GetMapping
    public ApiResponse<UserActivityStatsDTO> getStats(@PathVariable Long userId) {
        return ApiResponse.success(userActivityStatsService.getStats(userId));
    }
}
