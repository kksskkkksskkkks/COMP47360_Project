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

    @Query("""
            SELECT g FROM GemPeriod g
            JOIN FETCH g.attraction
            WHERE g.forecastDate = :forecastDate
            ORDER BY g.startTime ASC, g.gemScore DESC
            """)
    List<GemPeriod> findByForecastDateOrderByStartTimeAscGemScoreDesc(LocalDate forecastDate);

    @Query("""
            SELECT g FROM GemPeriod g
            JOIN FETCH g.attraction
            WHERE g.forecastDate = :forecastDate
              AND g.attraction.category IN :categories
            ORDER BY g.startTime ASC, g.gemScore DESC
            """)
    List<GemPeriod> findByForecastDateAndCategories(@Param("forecastDate") LocalDate forecastDate,
                                                    @Param("categories") List<String> categories);

    @Query("""
            SELECT g FROM GemPeriod g
            JOIN FETCH g.attraction
            WHERE g.forecastDate = :forecastDate
              AND g.attraction.category IN :categories
              AND g.attraction.wheelchair >= :wheelchair
            ORDER BY g.startTime ASC, g.gemScore DESC
            """)
    List<GemPeriod> findByForecastDateAndCategoriesAndWheelchair(
            @Param("forecastDate") LocalDate forecastDate,
            @Param("categories")  List<String> categories,
            @Param("wheelchair")  Integer wheelchair);

    @Query("""
            SELECT g FROM GemPeriod g
            JOIN FETCH g.attraction
            WHERE g.forecastDate = :forecastDate
              AND g.attraction.wheelchair >= :wheelchair
            ORDER BY g.startTime ASC, g.gemScore DESC
            """)
    List<GemPeriod> findByForecastDateAndWheelchair(@Param("forecastDate") LocalDate forecastDate,
                                                    @Param("wheelchair")  Integer wheelchair);

    @Transactional
    @Modifying
    @Query("DELETE FROM GemPeriod g WHERE g.forecastDate < :cutoff")
    void deleteByForecastDateBefore(@Param("cutoff") LocalDate cutoff);

}