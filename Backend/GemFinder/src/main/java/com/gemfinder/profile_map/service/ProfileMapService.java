package com.gemfinder.profile_map.service;

import com.gemfinder.profile_map.dto.ProfileMapPointDTO;

import java.util.List;

public interface ProfileMapService {

    /** Returns all checkin points aggregated by location for profile map rendering. */
    List<ProfileMapPointDTO> getProfileMapPoints(Long userId);
}
