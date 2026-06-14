package com.gemfinder.user.mapper;

import com.gemfinder.user.dto.UserCheckinDTO;
import com.gemfinder.user.entity.UserCheckin;

public class UserCheckinMapper {

    private UserCheckinMapper() {}

    public static UserCheckinDTO toDTO(UserCheckin e) {
        UserCheckinDTO dto = new UserCheckinDTO();
        dto.setId(e.getId());
        dto.setUserId(e.getUser().getId());
        dto.setAttractionId(e.getAttraction().getId());
        dto.setBusynessAtVisit(e.getBusynessAtVisit());
        dto.setVisitedAt(e.getVisitedAt());
        return dto;
    }
}
