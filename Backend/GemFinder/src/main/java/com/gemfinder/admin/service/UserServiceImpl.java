package com.gemfinder.admin.service;

import com.gemfinder.admin.dto.UserDTO;
import com.gemfinder.admin.entity.User;
//import com.gemfinder.admin.entity.User.Role;
import com.gemfinder.admin.mapper.UserMapper;
import com.gemfinder.admin.repository.UserRepository;
import com.gemfinder.admin.service.UserService;
import com.gemfinder.enums.Role;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;

    // ── Single-record lookup ───────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public UserDTO getById(Long id) {
        return UserMapper.toDTO(findOrThrow(id));
    }

    // ── Admin queries ──────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<UserDTO> getAll(Pageable pageable) {
        return userRepository.findAll(pageable).map(UserMapper::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserDTO> getByActiveStatus(Boolean isActive, Pageable pageable) {
        return userRepository.findByIsActive(isActive, pageable).map(UserMapper::toDTO);
    }

    // ── Admin write operations ─────────────────────────────────────────

    @Override
    @Transactional
    public UserDTO updateRole(Long id, Role role, Role actorRole) {
        User user = findOrThrow(id);
        // Controller already restricts this method to SUPERADMIN callers,
        // but a SUPERADMIN still must not be able to touch another SUPERADMIN.
        if (user.getRole() == Role.SUPERADMIN) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Cannot change another superadmin's role");
        }
        user.setRole(role);
        // Force re-login immediately after a role change, so the user can no
        // longer act under their old (possibly higher) privilege level using
        // an already-issued token.
        user.setTokenVersion(user.getTokenVersion() + 1);
        log.info("Updated role for user id={} to {}, tokenVersion={}", id, role, user.getTokenVersion());
        return UserMapper.toDTO(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserDTO deactivate(Long id, Role actorRole) {
        User user = findOrThrow(id);
        checkTargetRoleAllowed(user, actorRole);
        user.setIsActive(false);
        // Invalidate existing tokens immediately upon ban
        user.setTokenVersion(user.getTokenVersion() + 1);
        log.info("Deactivated user id={}, tokenVersion={}", id, user.getTokenVersion());
        return UserMapper.toDTO(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserDTO activate(Long id, Role actorRole) {
        User user = findOrThrow(id);
        checkTargetRoleAllowed(user, actorRole);
        user.setIsActive(true);
        log.info("Activated user id={}", id);
        return UserMapper.toDTO(userRepository.save(user));
    }

    // ── Private helpers ────────────────────────────────────────────────

    private User findOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found with id: " + id));
    }

    /**
     * Enforces the target-role rules for deactivate()/activate():
     *   - ADMIN may only act on a target whose current role is USER.
     *   - SUPERADMIN may act on anyone except another SUPERADMIN.
     * (USER callers never reach here — blocked earlier by @PreAuthorize.)
     */
    private void checkTargetRoleAllowed(User target, Role actorRole) {
        if (actorRole == Role.ADMIN && target.getRole() != Role.USER) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Admins may only modify accounts with role USER");
        }
        if (actorRole == Role.SUPERADMIN && target.getRole() == Role.SUPERADMIN) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Cannot modify another superadmin's account");
        }
    }
}
