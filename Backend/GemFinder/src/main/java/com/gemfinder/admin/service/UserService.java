package com.gemfinder.admin.service;

import com.gemfinder.admin.dto.UserDTO;
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

    /**
     * Updates a user's role.
     * SUPERADMIN-only at the controller level. The target user's CURRENT
     * role must not be SUPERADMIN — no one may change a superadmin's role.
     */
    UserDTO updateRole(Long id, Role role, Role actorRole);

    /**
     * Deactivates a user account (soft delete).
     * ADMIN may only deactivate users whose current role is USER.
     * SUPERADMIN may deactivate anyone except another SUPERADMIN.
     */
    UserDTO deactivate(Long id, Role actorRole);

    /**
     * Reactivates a previously deactivated user account.
     * Same target-role restrictions as deactivate().
     */
    UserDTO activate(Long id, Role actorRole);
}
