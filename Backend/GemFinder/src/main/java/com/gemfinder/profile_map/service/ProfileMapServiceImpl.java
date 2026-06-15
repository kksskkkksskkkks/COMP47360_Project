package com.gemfinder.profile_map.service;

import com.gemfinder.profile_map.dto.ProfileMapPointDTO;
import com.gemfinder.profile_map.service.ProfileMapService;
import com.gemfinder.profile_map.dto.ProfileMapPointDTO;
import com.gemfinder.profile_map.service.ProfileMapService;
import com.gemfinder.user.repository.UserCheckinRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProfileMapServiceImpl implements ProfileMapService {

    private final UserCheckinRepository userCheckinRepository;

    @Override
    @Transactional(readOnly = true)
    public List<ProfileMapPointDTO> getProfileMapPoints(Long userId) {
        return userCheckinRepository.findProfileMapPointsByUserId(userId);
    }
}
