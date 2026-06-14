package com.gemfinder.user.repository;

import com.gemfinder.heat_map.dto.HeatmapPointDTO;
import com.gemfinder.user.entity.UserCheckin;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserCheckinRepository extends JpaRepository<UserCheckin, Long> {

    Page<UserCheckin> findByUserId(Long userId, Pageable pageable);

    Page<UserCheckin> findByAttractionId(Long attractionId, Pageable pageable);

    // Aggregate checkins by attraction for profile map rendering
    @Query("""
            SELECT new com.gemfinder.heat_map.dto.HeatmapPointDTO(
                c.attraction.lat,
                c.attraction.lon,
                COUNT(c)
            )
            FROM UserCheckin c
            GROUP BY c.attraction.lat, c.attraction.lon
            """)
    List<HeatmapPointDTO> findHeatmapPoints();
}
