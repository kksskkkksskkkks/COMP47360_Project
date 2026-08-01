package com.gemfinder.user.mapper;

import com.gemfinder.user.dto.UserFavoriteDTO;
import com.gemfinder.user.entity.UserFavorite;

public class UserFavoriteMapper {

    private UserFavoriteMapper() {}

    public static UserFavoriteDTO toDTO(UserFavorite e) {
        UserFavoriteDTO dto = new UserFavoriteDTO();
        dto.setId(e.getId());
        dto.setUserId(e.getUser().getId());
        dto.setAttractionId(e.getAttraction().getId());
        dto.setCreatedAt(e.getCreatedAt());
        return dto;
    }
}
