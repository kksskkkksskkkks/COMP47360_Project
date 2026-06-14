package com.gemfinder.user.repository;

import com.gemfinder.user.entity.UserFavorite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserFavoriteRepository extends JpaRepository<UserFavorite, Long> {

    Page<UserFavorite> findByUserId(Long userId, Pageable pageable);

    Optional<UserFavorite> findByUserIdAndAttractionId(Long userId, Long attractionId);

    boolean existsByUserIdAndAttractionId(Long userId, Long attractionId);
}
