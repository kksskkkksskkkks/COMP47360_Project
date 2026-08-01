package com.gemfinder.user.mapper;

import com.gemfinder.user.dto.UserRatingDTO;
import com.gemfinder.user.entity.UserRating;

public class UserRatingMapper {

    private UserRatingMapper() {}

    public static UserRatingDTO toDTO(UserRating e) {
        UserRatingDTO dto = new UserRatingDTO();
        dto.setId(e.getId());
        dto.setUserId(e.getUser().getId());
        dto.setAttractionId(e.getAttraction().getId());
        dto.setRating(e.getRating());
        dto.setCreatedAt(e.getCreatedAt());
        dto.setUpdatedAt(e.getUpdatedAt());
        return dto;
    }
}
