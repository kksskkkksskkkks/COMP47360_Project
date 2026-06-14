package com.gemfinder.auth.mapper;

import com.gemfinder.auth.dto.UserDTO;
import com.gemfinder.auth.entity.User;

public class UserMapper {

    private UserMapper() {}

    public static UserDTO toDTO(User e) {
        UserDTO dto = new UserDTO();
        dto.setId(e.getId());
        dto.setUsername(e.getUsername());
        dto.setEmail(e.getEmail());
        dto.setRole(e.getRole());
        dto.setIsActive(e.getIsActive());
        dto.setHighContrast(e.getHighContrast());
        dto.setCreatedAt(e.getCreatedAt());
        dto.setUpdatedAt(e.getUpdatedAt());
        return dto;
    }
}
