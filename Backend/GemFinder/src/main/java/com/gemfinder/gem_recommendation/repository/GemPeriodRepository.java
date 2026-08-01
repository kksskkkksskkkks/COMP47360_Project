package com.gemfinder.gem_recommendation.repository;

import com.gemfinder.gem_recommendation.entity.GemPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface GemPeriodRepository extends JpaRepository<GemPeriod, Long> {

    // ── Attraction detail page — bar chart ─────────────────────────
    // Returns all gem periods for a specific attraction and date
    @Query("""
            SELECT g FROM GemPeriod g
            WHERE g.attraction.id = :attractionId
              AND g.forecastDate = :date
            ORDER BY g.startTime ASC
            """)
    List<GemPeriod> findByAttractionIdAndDate(@Param("attractionId") Long attractionId,
                                              @Param("date") LocalDate date);

    // ── Recommendation — all gem periods for given dates ───────────
    @Query("""
            SELECT g FROM GemPeriod g
            JOIN FETCH g.attraction
            WHERE g.forecastDate IN :dates
            ORDER BY g.startTime ASC, g.attraction.avgRating DESC
            """)
    List<GemPeriod> findByForecastDatesOrderByStartTimeAscAvgRatingDesc(
            @Param("dates") List<LocalDate> dates);

    @Query("""
            SELECT g FROM GemPeriod g
            JOIN FETCH g.attraction
            WHERE g.forecastDate IN :dates
              AND g.attraction.category IN :categories
            ORDER BY g.startTime ASC, g.attraction.avgRating DESC
            """)
    List<GemPeriod> findByForecastDatesAndCategories(
            @Param("dates")      List<LocalDate> dates,
            @Param("categories") List<String> categories);

    @Query("""
            SELECT g FROM GemPeriod g
            JOIN FETCH g.attraction
            WHERE g.forecastDate IN :dates
              AND g.attraction.category IN :categories
              AND g.attraction.wheelchair >= :wheelchair
            ORDER BY g.startTime ASC, g.attraction.avgRating DESC
            """)
    List<GemPeriod> findByForecastDatesAndCategoriesAndWheelchair(
            @Param("dates")      List<LocalDate> dates,
            @Param("categories") List<String> categories,
            @Param("wheelchair") Integer wheelchair);

    @Query("""
            SELECT g FROM GemPeriod g
            JOIN FETCH g.attraction
            WHERE g.forecastDate IN :dates
              AND g.attraction.wheelchair >= :wheelchair
            ORDER BY g.startTime ASC, g.attraction.avgRating DESC
            """)
    List<GemPeriod> findByForecastDatesAndWheelchair(
            @Param("dates")      List<LocalDate> dates,
            @Param("wheelchair") Integer wheelchair);

    // ── Maintenance ────────────────────────────────────────────────
    @Transactional
    @Modifying
    @Query("DELETE FROM GemPeriod g WHERE g.forecastDate < :cutoff")
    void deleteByForecastDateBefore(@Param("cutoff") LocalDate cutoff);
}