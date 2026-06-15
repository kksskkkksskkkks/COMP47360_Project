package com.gemfinder.busyness_forecast.repository;

import com.gemfinder.busyness_forecast.entity.BusynessForecast;
import com.gemfinder.busyness_forecast.entity.BusynessForecastId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BusynessForecastRepository extends JpaRepository<BusynessForecast, BusynessForecastId> {

    // Single lookup: zone + time slot
    @Query("SELECT f FROM BusynessForecast f WHERE f.id.zoneId = :zoneId AND f.id.timeBucket = :timeBucket")
    Optional<BusynessForecast> findByZoneIdAndTimeBucket(@Param("zoneId") Integer zoneId,
                                                         @Param("timeBucket") LocalDateTime timeBucket);

    // All slots for a zone within a time range (e.g. next 48h)
    @Query("SELECT f FROM BusynessForecast f WHERE f.id.zoneId = :zoneId AND f.id.timeBucket BETWEEN :from AND :to ORDER BY f.id.timeBucket")
    List<BusynessForecast> findByZoneIdAndTimeRange(@Param("zoneId") Integer zoneId,
                                                    @Param("from") LocalDateTime from,
                                                    @Param("to") LocalDateTime to);

    // All zones for a single time slot (for heatmap snapshot)
    @Query("SELECT f FROM BusynessForecast f WHERE f.id.timeBucket = :timeBucket ORDER BY f.id.zoneId")
    List<BusynessForecast> findAllZonesByTimeBucket(@Param("timeBucket") LocalDateTime timeBucket);
}
