package com.gemfinder.user.service;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.attractions.service.AttractionService;
import com.gemfinder.admin.entity.User;
import com.gemfinder.admin.repository.UserRepository;
import com.gemfinder.user.dto.RatingRequest;
import com.gemfinder.user.dto.UserRatingDTO;
import com.gemfinder.user.entity.UserRating;
import com.gemfinder.user.mapper.UserRatingMapper;
import com.gemfinder.user.repository.UserRatingRepository;
import com.gemfinder.user.service.UserRatingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class UserRatingServiceImpl implements UserRatingService {

    private final UserRatingRepository userRatingRepository;
    private final UserRepository userRepository;
    private final AttractionRepository attractionRepository;
    private final AttractionService attractionService;

    @Override
    @Transactional(readOnly = true)
    public Page<UserRatingDTO> getByUser(Long userId, Pageable pageable) {
        return userRatingRepository.findByUserId(userId, pageable)
                .map(rating -> UserRatingMapper.toDTO(rating));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserRatingDTO> getByAttraction(Long attractionId, Pageable pageable) {
        return userRatingRepository.findByAttractionId(attractionId, pageable)
                .map(rating -> UserRatingMapper.toDTO(rating));
    }

    @Override
    @Transactional(readOnly = true)
    public UserRatingDTO getByUserAndAttraction(Long userId, Long attractionId) {
        return userRatingRepository.findByUserIdAndAttractionId(userId, attractionId)
                .map(rating -> UserRatingMapper.toDTO(rating))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Rating not found"));
    }

    @Override
    @Transactional
    public UserRatingDTO add(Long userId, Long attractionId, RatingRequest request) {
        if (userRatingRepository.existsByUserIdAndAttractionId(userId, attractionId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "User has already rated this attraction");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found with id: " + userId));

        Attraction attraction = attractionRepository.findById(attractionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Attraction not found with id: " + attractionId));

        UserRating rating = new UserRating();
        rating.setUser(user);
        rating.setAttraction(attraction);
        rating.setRating(request.getRating());

        UserRatingDTO saved = UserRatingMapper.toDTO(userRatingRepository.save(rating));

        // Refresh cached avg rating on the attraction
        attractionService.refreshRatingStats(attractionId);

        return saved;
    }

    @Override
    @Transactional
    public UserRatingDTO update(Long userId, Long attractionId, RatingRequest request) {
        UserRating rating = userRatingRepository
                .findByUserIdAndAttractionId(userId, attractionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Rating not found"));

        rating.setRating(request.getRating());

        UserRatingDTO saved = UserRatingMapper.toDTO(userRatingRepository.save(rating));

        // Refresh cached avg rating on the attraction
        attractionService.refreshRatingStats(attractionId);

        return saved;
    }

    @Override
    @Transactional
    public void delete(Long userId, Long attractionId) {
        UserRating rating = userRatingRepository
                .findByUserIdAndAttractionId(userId, attractionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Rating not found"));

        userRatingRepository.delete(rating);

        // Refresh cached avg rating on the attraction
        attractionService.refreshRatingStats(attractionId);
    }
}
