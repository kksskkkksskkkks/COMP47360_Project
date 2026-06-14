package com.gemfinder.auth.service;

import com.gemfinder.auth.dto.LoginRequest;
import com.gemfinder.auth.dto.RegisterRequest;
import com.gemfinder.admin.dto.UserDTO;
import com.gemfinder.admin.entity.User;
import com.gemfinder.admin.mapper.UserMapper;
import com.gemfinder.admin.repository.UserRepository;
import com.gemfinder.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
//import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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

    // BCrypt for password hashing; no Spring Security needed
//    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

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
        // role defaults to USER, isActive defaults to true (set in entity)

        User saved = userRepository.save(user);
        log.info("Registered new user id={}, email={}", saved.getId(), saved.getEmail());
        return UserMapper.toDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDTO login(LoginRequest request) {
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

        log.info("User logged in id={}, email={}", user.getId(), user.getEmail());
        return UserMapper.toDTO(user);
    }
}
