package com.gemfinder.admin.mapper;

import com.gemfinder.admin.dto.UserDTO;
import com.gemfinder.admin.entity.User;

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
