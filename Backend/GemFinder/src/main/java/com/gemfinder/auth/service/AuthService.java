package com.gemfinder.auth.service;

import com.gemfinder.auth.dto.*;
import com.gemfinder.admin.dto.UserDTO;

public interface AuthService {

    /** Register a new user, returning the user info */
    UserDTO register(RegisterRequest request);

    /** Validate login credentials; on success return a JWT + user info */
    JwtResponse login(LoginRequest request);

    /** Change the password */
    void updatePassword(Long userId, UpdatePasswordRequest request);

    /** Immediately invalidate all tokens currently issued to this user (force logout of all devices) */
    void logoutAllDevices(Long userId);

    /** Updates the high contrast preference for the current user */
    UserDTO updateHighContrast(Long userId, Boolean highContrast);

    /** Updates the current user's username; throws 409 if already taken */
    UserDTO updateUsername(Long userId, UpdateUsernameRequest request);

    /** Updates the current user's email; throws 409 if already in use */
    UserDTO updateEmail(Long userId, UpdateEmailRequest request);
}
