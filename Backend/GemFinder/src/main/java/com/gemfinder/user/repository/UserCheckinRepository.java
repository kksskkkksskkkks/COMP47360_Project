package com.gemfinder.user.repository;

import com.gemfinder.profile_map.dto.ProfileMapPointDTO;
import com.gemfinder.user.entity.UserCheckin;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;


import java.util.List;

@Repository
public interface UserCheckinRepository extends JpaRepository<UserCheckin, Long> {

    Page<UserCheckin> findByUserId(Long userId, Pageable pageable);

    Page<UserCheckin> findByAttractionId(Long attractionId, Pageable pageable);

    // For user stats: distinct attractions visited (does not count repeat checkins at the same place)
    @Query("SELECT COUNT(DISTINCT c.attraction.id) FROM UserCheckin c WHERE c.user.id = :userId")
    long countDistinctAttractionByUserId(@Param("userId") Long userId);

}