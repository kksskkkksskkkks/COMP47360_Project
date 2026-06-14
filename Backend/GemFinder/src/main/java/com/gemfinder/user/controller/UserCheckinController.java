package com.gemfinder.user.controller;

import com.gemfinder.user.dto.CheckinRequest;
import com.gemfinder.user.dto.UserCheckinDTO;
import com.gemfinder.user.service.UserCheckinService;
import com.gemfinder.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;


@RestController
@RequiredArgsConstructor
public class UserCheckinController {

    private final UserCheckinService userCheckinService;

    @GetMapping("/api/users/{userId}/checkins")
    public ApiResponse<Page<UserCheckinDTO>> getByUser(
            @PathVariable Long userId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success(userCheckinService.getByUser(userId, pageable));
    }

    @GetMapping("/api/attractions/{attractionId}/checkins")
    public ApiResponse<Page<UserCheckinDTO>> getByAttraction(
            @PathVariable Long attractionId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success(userCheckinService.getByAttraction(attractionId, pageable));
    }

    @PostMapping("/api/users/{userId}/checkins/{attractionId}")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserCheckinDTO> checkin(
            @PathVariable Long userId,
            @PathVariable Long attractionId,
            @Valid @RequestBody CheckinRequest request) {
        return ApiResponse.success(userCheckinService.checkin(userId, attractionId, request));
    }
}
