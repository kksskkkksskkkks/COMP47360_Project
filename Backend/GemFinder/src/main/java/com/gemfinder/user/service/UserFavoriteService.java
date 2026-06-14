package com.gemfinder.user.service;

import com.gemfinder.user.dto.UserFavoriteDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserFavoriteService {

    /** Returns all favorites for a user (paginated). */
    Page<UserFavoriteDTO> getByUser(Long userId, Pageable pageable);

    /** Adds an attraction to a user's favorites; throws 409 if already favorited. */
    UserFavoriteDTO add(Long userId, Long attractionId);

    /** Removes an attraction from a user's favorites; throws 404 if not found. */
    void remove(Long userId, Long attractionId);

    /** Returns whether a user has favorited an attraction. */
    boolean isFavorited(Long userId, Long attractionId);
}
