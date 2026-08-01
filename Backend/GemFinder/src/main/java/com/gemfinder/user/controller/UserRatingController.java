package com.gemfinder.user.controller;

import com.gemfinder.user.dto.RatingRequest;
import com.gemfinder.user.dto.UserRatingDTO;
import com.gemfinder.user.service.UserRatingService;
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
public class UserRatingController {

    private final UserRatingService userRatingService;

    @GetMapping("/api/users/{userId}/ratings")
    public ApiResponse<Page<UserRatingDTO>> getByUser(
            @PathVariable Long userId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success(userRatingService.getByUser(userId, pageable));
    }

    @GetMapping("/api/attractions/{attractionId}/ratings")
    public ApiResponse<Page<UserRatingDTO>> getByAttraction(
            @PathVariable Long attractionId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success(userRatingService.getByAttraction(attractionId, pageable));
    }

    @GetMapping("/api/users/{userId}/ratings/{attractionId}")
    public ApiResponse<UserRatingDTO> getByUserAndAttraction(
            @PathVariable Long userId,
            @PathVariable Long attractionId) {
        return ApiResponse.success(userRatingService.getByUserAndAttraction(userId, attractionId));
    }

    @PostMapping("/api/users/{userId}/ratings/{attractionId}")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserRatingDTO> add(
            @PathVariable Long userId,
            @PathVariable Long attractionId,
            @Valid @RequestBody RatingRequest request) {
        return ApiResponse.success(userRatingService.add(userId, attractionId, request));
    }

    @PutMapping("/api/users/{userId}/ratings/{attractionId}")
    public ApiResponse<UserRatingDTO> update(
            @PathVariable Long userId,
            @PathVariable Long attractionId,
            @Valid @RequestBody RatingRequest request) {
        return ApiResponse.success(userRatingService.update(userId, attractionId, request));
    }

    @DeleteMapping("/api/users/{userId}/ratings/{attractionId}")
    public ApiResponse<Void> delete(
            @PathVariable Long userId,
            @PathVariable Long attractionId) {
        userRatingService.delete(userId, attractionId);
        return ApiResponse.success(null);
    }
}