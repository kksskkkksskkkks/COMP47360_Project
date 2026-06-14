package com.gemfinder.user.controller;

import com.gemfinder.user.dto.RatingRequest;
import com.gemfinder.user.dto.UserRatingDTO;
import com.gemfinder.user.service.UserRatingService;
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

    // GET /api/users/{userId}/ratings
    @GetMapping("/api/users/{userId}/ratings")
    public Page<UserRatingDTO> getByUser(
            @PathVariable Long userId,
            @PageableDefault(size = 20) Pageable pageable) {
        return userRatingService.getByUser(userId, pageable);
    }

    // GET /api/attractions/{attractionId}/ratings
    @GetMapping("/api/attractions/{attractionId}/ratings")
    public Page<UserRatingDTO> getByAttraction(
            @PathVariable Long attractionId,
            @PageableDefault(size = 20) Pageable pageable) {
        return userRatingService.getByAttraction(attractionId, pageable);
    }

    // GET /api/users/{userId}/ratings/{attractionId}
    @GetMapping("/api/users/{userId}/ratings/{attractionId}")
    public UserRatingDTO getByUserAndAttraction(@PathVariable Long userId,
                                                @PathVariable Long attractionId) {
        return userRatingService.getByUserAndAttraction(userId, attractionId);
    }

    // POST /api/users/{userId}/ratings/{attractionId}
    @PostMapping("/api/users/{userId}/ratings/{attractionId}")
    @ResponseStatus(HttpStatus.CREATED)
    public UserRatingDTO add(@PathVariable Long userId,
                             @PathVariable Long attractionId,
                             @Valid @RequestBody RatingRequest request) {
        return userRatingService.add(userId, attractionId, request);
    }

    // PUT /api/users/{userId}/ratings/{attractionId}
    @PutMapping("/api/users/{userId}/ratings/{attractionId}")
    public UserRatingDTO update(@PathVariable Long userId,
                                @PathVariable Long attractionId,
                                @Valid @RequestBody RatingRequest request) {
        return userRatingService.update(userId, attractionId, request);
    }

    // DELETE /api/users/{userId}/ratings/{attractionId}
    @DeleteMapping("/api/users/{userId}/ratings/{attractionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long userId,
                       @PathVariable Long attractionId) {
        userRatingService.delete(userId, attractionId);
    }
}
