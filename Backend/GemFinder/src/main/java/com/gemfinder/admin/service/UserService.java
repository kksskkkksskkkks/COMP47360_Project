package com.gemfinder.admin.service;

import com.gemfinder.admin.dto.UserDTO;
import com.gemfinder.auth.dto.*;
import com.gemfinder.enums.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserService {

    // ── Single-record lookup ───────────────────────────────────────────

    /** Finds a user by primary key; throws 404 if absent. */
    UserDTO getById(Long id);

    // ── Admin queries ──────────────────────────────────────────────────

    /** Returns all users (paginated). */
    Page<UserDTO> getAll(Pageable pageable);

    /** Filters users by active status (paginated). */
    Page<UserDTO> getByActiveStatus(Boolean isActive, Pageable pageable);

    // ── Admin write operations ─────────────────────────────────────────

    /** Updates a user's role. */
    UserDTO updateRole(Long id, Role role);

    /** Deactivates a user account (soft delete). */
    UserDTO deactivate(Long id);

    /** Reactivates a previously deactivated user account. */
    UserDTO activate(Long id);

    // ── User self-service ──────────────────────────────────────────────

    /** Updates the high contrast preference for the given user. */
    UserDTO updateHighContrast(Long id, Boolean highContrast);

    /** Updates username; throws 409 if already taken. */
    UserDTO updateUsername(Long id, UpdateUsernameRequest request);

    /** Updates email; throws 409 if already in use. */
    UserDTO updateEmail(Long id, UpdateEmailRequest request);

    /** Updates password; throws 401 if current password is wrong. */
    UserDTO updatePassword(Long id, UpdatePasswordRequest request);
}
