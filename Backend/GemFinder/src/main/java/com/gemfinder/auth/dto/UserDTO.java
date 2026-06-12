package com.gemfinder.auth.dto;

import com.gemfinder.auth.entity.User.Role;
import lombok.Data;

import java.time.Instant;

@Data
public class UserDTO {

    private Long id;
    private String username;
    private String email;
    private Role role;
    private Boolean isActive;
    private Boolean highContrast;
    private Instant createdAt;
    private Instant updatedAt;
}
