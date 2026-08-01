package com.gemfinder.user.repository;

import com.gemfinder.user.entity.UserRating;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRatingRepository extends JpaRepository<UserRating, Long> {

    Page<UserRating> findByUserId(Long userId, Pageable pageable);

    Page<UserRating> findByAttractionId(Long attractionId, Pageable pageable);

    Optional<UserRating> findByUserIdAndAttractionId(Long userId, Long attractionId);

    boolean existsByUserIdAndAttractionId(Long userId, Long attractionId);

    // For user stats: total ratings count
    long countByUserId(Long userId);
}
