package com.gemfinder.admin.dto;

//import com.gemfinder.admin.entity.User.Role;
import com.gemfinder.enums.Role;
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
