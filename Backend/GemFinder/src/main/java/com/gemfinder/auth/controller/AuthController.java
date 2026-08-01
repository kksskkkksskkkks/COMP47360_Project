package com.gemfinder.auth.controller;

import com.gemfinder.admin.dto.UserDTO;
import com.gemfinder.auth.dto.*;
import com.gemfinder.auth.service.AuthService;
import com.gemfinder.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // POST /api/auth/register
    /** Register — public endpoint */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserDTO> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.success(authService.register(request));
    }

    // POST /api/auth/login
    /**
     * Login — public endpoint
     * On success returns: { "data": { "token": "...", "user": { ... } } }
     */
    @PostMapping("/login")
    public ApiResponse<JwtResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(authService.login(request));
    }

    // PUT /api/auth/password
    /** Change password — requires login (must carry a valid JWT) */
    @PutMapping("/password")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Void> updatePassword(
            @Valid @RequestBody UpdatePasswordRequest request,
            @RequestAttribute("userId") Long userId) {   // injected by JwtAuthFilter
        authService.updatePassword(userId, request);
        return ApiResponse.success(null);
    }

    // POST /api/auth/logout-all
    /** Force logout of all devices — immediately invalidates all currently issued tokens */
    @PostMapping("/logout-all")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Void> logoutAllDevices(@RequestAttribute("userId") Long userId) {
        authService.logoutAllDevices(userId);
        return ApiResponse.success(null);
    }

    // PATCH /api/auth/high-contrast
    /** Update the current user's high-contrast preference */
    @PatchMapping("/high-contrast")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<UserDTO> updateHighContrast(
            @RequestParam Boolean highContrast,
            @RequestAttribute("userId") Long userId) {
        return ApiResponse.success(authService.updateHighContrast(userId, highContrast));
    }

    // PATCH /api/auth/username
    /** Update the current user's username — throws 409 if already taken */
    @PatchMapping("/username")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<UserDTO> updateUsername(
            @Valid @RequestBody UpdateUsernameRequest request,
            @RequestAttribute("userId") Long userId) {
        return ApiResponse.success(authService.updateUsername(userId, request));
    }

    // PATCH /api/auth/email
    /** Update the current user's email — throws 409 if already in use */
    @PatchMapping("/email")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<UserDTO> updateEmail(
            @Valid @RequestBody UpdateEmailRequest request,
            @RequestAttribute("userId") Long userId) {
        return ApiResponse.success(authService.updateEmail(userId, request));
    }
}