package com.gemfinder.auth.service;

import com.gemfinder.auth.dto.LoginRequest;
import com.gemfinder.auth.dto.RegisterRequest;
import com.gemfinder.admin.dto.UserDTO;

public interface AuthService {

    /** Registers a new user; throws 409 if email or username already exists. */
    UserDTO register(RegisterRequest request);

    /** Validates credentials and returns the user; throws 401 if invalid. */
    UserDTO login(LoginRequest request);
}