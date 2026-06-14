package com.gemfinder.user.controller;

import com.gemfinder.user.dto.UserFavoriteDTO;
import com.gemfinder.user.service.UserFavoriteService;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users/{userId}/favorites")
@RequiredArgsConstructor
public class UserFavoriteController {

    private final UserFavoriteService userFavoriteService;

    @GetMapping
    public ApiResponse<Page<UserFavoriteDTO>> getByUser(
            @PathVariable Long userId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success(userFavoriteService.getByUser(userId, pageable));
    }

    @GetMapping("/{attractionId}")
    public ApiResponse<Boolean> isFavorited(@PathVariable Long userId,
                                            @PathVariable Long attractionId) {
        return ApiResponse.success(userFavoriteService.isFavorited(userId, attractionId));
    }

    @PostMapping("/{attractionId}")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserFavoriteDTO> add(@PathVariable Long userId,
                                            @PathVariable Long attractionId) {
        return ApiResponse.success(userFavoriteService.add(userId, attractionId));
    }

    @DeleteMapping("/{attractionId}")
    public ApiResponse<Void> remove(@PathVariable Long userId,
                                    @PathVariable Long attractionId) {
        userFavoriteService.remove(userId, attractionId);
        return ApiResponse.success(null);
    }
}