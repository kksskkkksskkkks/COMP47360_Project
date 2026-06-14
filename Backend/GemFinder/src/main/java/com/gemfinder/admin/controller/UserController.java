package com.gemfinder.admin.controller;

import com.gemfinder.admin.dto.UserDTO;
import com.gemfinder.auth.dto.*;
//import com.gemfinder.auth.entity.User.Role;
import com.gemfinder.admin.service.UserService;
import com.gemfinder.enums.Role;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // ── Admin: query ───────────────────────────────────────────────────

    @GetMapping
    public Page<UserDTO> getAll(
            @RequestParam(required = false) Boolean isActive,
            @PageableDefault(size = 20) Pageable pageable) {
        if (isActive != null) {
            return userService.getByActiveStatus(isActive, pageable);
        }
        return userService.getAll(pageable);
    }

    @GetMapping("/{id}")
    public UserDTO getById(@PathVariable Long id) {
        return userService.getById(id);
    }

    // ── Admin: write ───────────────────────────────────────────────────

    @PatchMapping("/{id}/role")
    public UserDTO updateRole(@PathVariable Long id, @RequestParam Role role) {
        return userService.updateRole(id, role);
    }

    @PatchMapping("/{id}/deactivate")
    public UserDTO deactivate(@PathVariable Long id) {
        return userService.deactivate(id);
    }

    @PatchMapping("/{id}/activate")
    public UserDTO activate(@PathVariable Long id) {
        return userService.activate(id);
    }

    // ── User self-service ──────────────────────────────────────────────

    @PatchMapping("/{id}/high-contrast")
    public UserDTO updateHighContrast(@PathVariable Long id,
                                      @RequestParam Boolean highContrast) {
        return userService.updateHighContrast(id, highContrast);
    }

    @PatchMapping("/{id}/username")
    public UserDTO updateUsername(@PathVariable Long id,
                                  @Valid @RequestBody UpdateUsernameRequest request) {
        return userService.updateUsername(id, request);
    }

    @PatchMapping("/{id}/email")
    public UserDTO updateEmail(@PathVariable Long id,
                               @Valid @RequestBody UpdateEmailRequest request) {
        return userService.updateEmail(id, request);
    }

    @PatchMapping("/{id}/password")
    public UserDTO updatePassword(@PathVariable Long id,
                                  @Valid @RequestBody UpdatePasswordRequest request) {
        return userService.updatePassword(id, request);
    }
}
