package com.gemfinder.admin.controller;

import com.gemfinder.admin.dto.UserDTO;
//import com.gemfinder.auth.entity.User.Role;
import com.gemfinder.admin.service.UserService;
import com.gemfinder.enums.Role;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // ── Admin: query ───────────────────────────────────────────────────
    // Admin-only: lists/looks up arbitrary users, not just the caller.

    // GET /api/users
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERADMIN')")
    public ApiResponse<Page<UserDTO>> getAll(
            @RequestParam(required = false) Boolean isActive,
            @PageableDefault(size = 20) Pageable pageable) {
        if (isActive != null) {
            return ApiResponse.success(userService.getByActiveStatus(isActive, pageable));
        }
        return ApiResponse.success(userService.getAll(pageable));
    }

    // GET /api/users/{id}
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERADMIN')")
    public ApiResponse<UserDTO> getById(@PathVariable Long id) {
        return ApiResponse.success(userService.getById(id));
    }

    // ── Admin: write ───────────────────────────────────────────────────
    // Admin-only: these change another user's role/active status.

    // PATCH /api/users/{id}/role
    // Restricted to SUPERADMIN at the gate; UserServiceImpl additionally
    // blocks changing another SUPERADMIN's role.
    @PatchMapping("/{id}/role")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ApiResponse<UserDTO> updateRole(@PathVariable Long id,
                              @RequestParam Role role,
                              @RequestAttribute("role") String actorRole) {
        return ApiResponse.success(userService.updateRole(id, role, Role.valueOf(actorRole)));
    }

    // PATCH /api/users/{id}/deactivate
    // Target-role restrictions (ADMIN can't touch ADMIN/SUPERADMIN,
    // SUPERADMIN can't touch SUPERADMIN) are enforced in UserServiceImpl.
    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERADMIN')")
    public ApiResponse<UserDTO> deactivate(@PathVariable Long id,
                              @RequestAttribute("role") String actorRole) {
        return ApiResponse.success(userService.deactivate(id, Role.valueOf(actorRole)));
    }

    // PATCH /api/users/{id}/activate
    // Same target-role restrictions as deactivate(), enforced in UserServiceImpl.
    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERADMIN')")
    public ApiResponse<UserDTO> activate(@PathVariable Long id,
                            @RequestAttribute("role") String actorRole) {
        return ApiResponse.success(userService.activate(id, Role.valueOf(actorRole)));
    }

    // Note: self-service profile edits (username/email/high-contrast) and
    // password changes live in AuthController now, under /api/auth/*.
    // They operate solely on the caller's own account (derived from the JWT),
    // never on an id supplied by the client — see AuthController/AuthService.
}
