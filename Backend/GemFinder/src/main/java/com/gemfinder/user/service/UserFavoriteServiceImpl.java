package com.gemfinder.user.service;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.admin.entity.User;
import com.gemfinder.admin.repository.UserRepository;
import com.gemfinder.user.dto.UserFavoriteDTO;
import com.gemfinder.user.entity.UserFavorite;
import com.gemfinder.user.mapper.UserFavoriteMapper;
import com.gemfinder.user.repository.UserFavoriteRepository;
import com.gemfinder.user.service.UserFavoriteService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class UserFavoriteServiceImpl implements UserFavoriteService {

    private final UserFavoriteRepository userFavoriteRepository;
    private final UserRepository userRepository;
    private final AttractionRepository attractionRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<UserFavoriteDTO> getByUser(Long userId, Pageable pageable) {
        return userFavoriteRepository.findByUserId(userId, pageable)
                .map(favorite -> UserFavoriteMapper.toDTO(favorite));
    }

    @Override
    @Transactional
    public UserFavoriteDTO add(Long userId, Long attractionId) {
        if (userFavoriteRepository.existsByUserIdAndAttractionId(userId, attractionId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Attraction already favorited");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found with id: " + userId));

        Attraction attraction = attractionRepository.findById(attractionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Attraction not found with id: " + attractionId));

        UserFavorite favorite = new UserFavorite();
        favorite.setUser(user);
        favorite.setAttraction(attraction);

        return UserFavoriteMapper.toDTO(userFavoriteRepository.save(favorite));
    }

    @Override
    @Transactional
    public void remove(Long userId, Long attractionId) {
        UserFavorite favorite = userFavoriteRepository
                .findByUserIdAndAttractionId(userId, attractionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Favorite not found"));

        userFavoriteRepository.delete(favorite);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isFavorited(Long userId, Long attractionId) {
        return userFavoriteRepository.existsByUserIdAndAttractionId(userId, attractionId);
    }
}
