package com.gemfinder.user.service;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.admin.entity.User;
import com.gemfinder.admin.repository.UserRepository;
import com.gemfinder.user.dto.CheckinRequest;
import com.gemfinder.user.dto.UserCheckinDTO;
import com.gemfinder.user.entity.UserCheckin;
import com.gemfinder.user.mapper.UserCheckinMapper;
import com.gemfinder.user.repository.UserCheckinRepository;
import com.gemfinder.user.service.UserCheckinService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class UserCheckinServiceImpl implements UserCheckinService {

    private final UserCheckinRepository userCheckinRepository;
    private final UserRepository userRepository;
    private final AttractionRepository attractionRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<UserCheckinDTO> getByUser(Long userId, Pageable pageable) {
        return userCheckinRepository.findByUserId(userId, pageable)
                .map(checkin -> UserCheckinMapper.toDTO(checkin));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserCheckinDTO> getByAttraction(Long attractionId, Pageable pageable) {
        return userCheckinRepository.findByAttractionId(attractionId, pageable)
                .map(checkin -> UserCheckinMapper.toDTO(checkin));
    }

    @Override
    @Transactional
    public UserCheckinDTO checkin(Long userId, Long attractionId, CheckinRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found with id: " + userId));

        Attraction attraction = attractionRepository.findById(attractionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Attraction not found with id: " + attractionId));

        UserCheckin checkin = new UserCheckin();
        checkin.setUser(user);
        checkin.setAttraction(attraction);
        checkin.setBusynessAtVisit(request.getBusynessAtVisit());

        return UserCheckinMapper.toDTO(userCheckinRepository.save(checkin));
    }
}
