package com.gemfinder.attractions.repository;

import com.gemfinder.attractions.entity.Attraction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttractionRepository extends JpaRepository<Attraction, Long>,
        JpaSpecificationExecutor<Attraction> {

    // ── Query methods ──────────────────────────────────────────────────

    List<Attraction> findByZoneId(Integer zoneId);

    // ── Rating aggregation (called by refreshRatingStats) ──────────────

    @Modifying
    @Query("""
            UPDATE Attraction a
               SET a.avgRating   = :avgRating,
                   a.ratingCount = :ratingCount
             WHERE a.id = :id
            """)
    void updateRatingStats(@Param("id")          Long   id,
                           @Param("avgRating")   Double avgRating,
                           @Param("ratingCount") int    ratingCount);

    @Query("SELECT AVG(CAST(r.rating AS double)) FROM UserRating r WHERE r.attraction.id = :attractionId")
    Optional<Double> findRatingAvgByAttractionId(@Param("attractionId") Long attractionId);

    @Query("SELECT COUNT(r) FROM UserRating r WHERE r.attraction.id = :attractionId")
    int findRatingCountByAttractionId(@Param("attractionId") Long attractionId);
}