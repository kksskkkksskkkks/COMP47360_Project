package com.gemfinder.auth.service;

import com.gemfinder.admin.dto.UserDTO;
import com.gemfinder.admin.entity.User;
import com.gemfinder.admin.mapper.UserMapper;
import com.gemfinder.admin.repository.UserRepository;
import com.gemfinder.auth.dto.*;
import com.gemfinder.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Override
    @Transactional
    public UserDTO register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Email already in use: " + request.getEmail());
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Username already taken: " + request.getUsername());
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        // role defaults to USER, isActive defaults to true, tokenVersion defaults to 0 (all set on the entity)

        User saved = userRepository.save(user);
        log.info("Registered new user id={}, email={}", saved.getId(), saved.getEmail());
        return UserMapper.toDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public JwtResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!user.getIsActive()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Account is deactivated");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        String token = jwtUtil.generateToken(
                user.getId(), user.getRole(), user.getTokenVersion());
        log.info("User logged in id={}, email={}", user.getId(), user.getEmail());
        return new JwtResponse(token, UserMapper.toDTO(user));
    }

    @Override
    @Transactional
    public void updatePassword(Long userId, UpdatePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        // Invalidate existing tokens immediately after a password change: all devices must re-login
        user.setTokenVersion(user.getTokenVersion() + 1);
        log.info("Password updated for user id={}, tokenVersion={}", userId, user.getTokenVersion());
    }

    @Override
    @Transactional
    public void logoutAllDevices(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));

        user.setTokenVersion(user.getTokenVersion() + 1);
        log.info("Logged out all devices for user id={}, tokenVersion={}", userId, user.getTokenVersion());
    }

    @Override
    @Transactional
    public UserDTO updateHighContrast(Long userId, Boolean highContrast) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));
        user.setHighContrast(highContrast);
        return UserMapper.toDTO(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserDTO updateUsername(Long userId, UpdateUsernameRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Username already taken: " + request.getUsername());
        }
        user.setUsername(request.getUsername());
        log.info("Updated username for user id={}", userId);
        return UserMapper.toDTO(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserDTO updateEmail(Long userId, UpdateEmailRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Email already in use: " + request.getEmail());
        }
        user.setEmail(request.getEmail());
        log.info("Updated email for user id={}", userId);
        return UserMapper.toDTO(userRepository.save(user));
    }
}
