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

    // Aggregate checkins by attraction for profile map rendering
    @Query("""

            SELECT new com.gemfinder.profile_map.dto.ProfileMapPointDTO(
            c.attraction.id,
            c.attraction.zoneId,
            c.attraction.avgRating,
            c.attraction.imagePath,
            c.attraction.lat,
            c.attraction.lon,
            COUNT(c),
            c.attraction.name,
            c.attraction.category
        )
        FROM UserCheckin c
        WHERE c.user.id = :userId
        GROUP BY
            c.attraction.id,
            c.attraction.zoneId,
            c.attraction.avgRating,
            c.attraction.imagePath,
            c.attraction.lat,
            c.attraction.lon,
            c.attraction.name,
            c.attraction.category
        """)
    List<ProfileMapPointDTO> findProfileMapPointsByUserId(@Param("userId") Long userId);
    }