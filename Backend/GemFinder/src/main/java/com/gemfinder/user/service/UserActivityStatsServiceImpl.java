package com.gemfinder.user.service;

import com.gemfinder.admin.repository.UserRepository;
import com.gemfinder.user.repository.UserCheckinRepository;
import com.gemfinder.user.repository.UserFavoriteRepository;
import com.gemfinder.user.repository.UserRatingRepository;
import com.gemfinder.user.dto.UserActivityStatsDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class UserActivityStatsServiceImpl implements UserActivityStatsService {

    private final UserRepository userRepository;
    private final UserFavoriteRepository userFavoriteRepository;
    private final UserRatingRepository userRatingRepository;
    private final UserCheckinRepository userCheckinRepository;

    @Override
    @Transactional(readOnly = true)
    public UserActivityStatsDTO getStats(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "User not found with id: " + userId);
        }

        long favoriteCount = userFavoriteRepository.countByUserId(userId);
        long ratingCount = userRatingRepository.countByUserId(userId);
        long visitedPlaceCount = userCheckinRepository.countDistinctAttractionByUserId(userId);

        return new UserActivityStatsDTO(userId, favoriteCount, ratingCount, visitedPlaceCount);
    }
}
