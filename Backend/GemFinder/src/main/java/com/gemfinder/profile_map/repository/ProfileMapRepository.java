package com.gemfinder.profile_map.repository;

import com.gemfinder.profile_map.dto.ProfileMapPointDTO;
import com.gemfinder.user.entity.UserCheckin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProfileMapRepository extends JpaRepository<UserCheckin, Long> {

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