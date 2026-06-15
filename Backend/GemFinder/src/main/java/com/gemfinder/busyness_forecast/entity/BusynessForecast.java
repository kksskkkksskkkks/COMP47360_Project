package com.gemfinder.busyness_forecast.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

//import java.time.Instant;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@ToString
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(
        name = "busyness_forecast",
        indexes = {
                @Index(name = "idx_time_bucket", columnList = "time_bucket"),
                @Index(name = "idx_updated_at",  columnList = "updated_at")
        }
)
public class BusynessForecast {

    @EqualsAndHashCode.Include
    @EmbeddedId
    private BusynessForecastId id;

    @NotNull
    @PositiveOrZero
    @Column(name = "predicted_dropoffs", nullable = false)
    private Double predictedDropoffs;

    // range 0–5 validated by Flask predict.py before writing
    @NotNull
    @Column(name = "busyness_level", nullable = false)
    private Short busynessLevel;

    @NotNull
    @Column(name = "busyness_level_relative", nullable = false)
    private Short busynessLevelRelative;

    // debug / model-input fields — all nullable
    @Column(name = "temperature_2m")
    private Double temperature2m;

    @Column(name = "precipitation")
    private Double precipitation;

    @Column(name = "weathercode")
    private Short weathercode;

    @Column(name = "windspeed_10m")
    private Double windspeed10m;

    // timestamp of the Flask cron run that produced this batch;
    // passed in by Flask, stored as-is — NOT managed by Spring Auditing
    @NotNull
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}