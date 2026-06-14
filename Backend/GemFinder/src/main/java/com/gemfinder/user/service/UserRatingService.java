package com.gemfinder.user.service;

import com.gemfinder.user.dto.RatingRequest;
import com.gemfinder.user.dto.UserRatingDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserRatingService {

    /** Returns all ratings by a user (paginated). */
    Page<UserRatingDTO> getByUser(Long userId, Pageable pageable);

    /** Returns all ratings for an attraction (paginated). */
    Page<UserRatingDTO> getByAttraction(Long attractionId, Pageable pageable);

    /** Returns a user's rating for a specific attraction; throws 404 if not found. */
    UserRatingDTO getByUserAndAttraction(Long userId, Long attractionId);

    /** Submits a new rating; throws 409 if user already rated this attraction. */
    UserRatingDTO add(Long userId, Long attractionId, RatingRequest request);

    /** Updates an existing rating; throws 404 if not found. */
    UserRatingDTO update(Long userId, Long attractionId, RatingRequest request);

    /** Deletes a rating; throws 404 if not found. */
    void delete(Long userId, Long attractionId);
}
