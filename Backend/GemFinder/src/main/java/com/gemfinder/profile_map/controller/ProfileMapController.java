package com.gemfinder.profile_map.controller;

import com.gemfinder.profile_map.dto.ProfileMapPointDTO;
import com.gemfinder.profile_map.service.ProfileMapService;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users/{userId}/profile-map")
@RequiredArgsConstructor
public class ProfileMapController {

    private final ProfileMapService profileMapService;

    @GetMapping
    public ApiResponse<List<ProfileMapPointDTO>> getProfileMapPoints(
            @PathVariable Long userId) {
        return ApiResponse.success(profileMapService.getProfileMapPoints(userId));
    }
}
