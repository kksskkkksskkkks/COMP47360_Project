package com.gemfinder.auth.controller;

import com.gemfinder.auth.dto.LoginRequest;
import com.gemfinder.auth.dto.RegisterRequest;
import com.gemfinder.admin.dto.UserDTO;
import com.gemfinder.auth.service.AuthService;
import com.gemfinder.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserDTO> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.success(authService.register(request));

    }

    @PostMapping("/login")
    public ApiResponse<UserDTO> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(authService.login(request));
    }
}