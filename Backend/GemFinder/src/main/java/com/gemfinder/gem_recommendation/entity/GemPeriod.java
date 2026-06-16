package com.gemfinder.gem_recommendation.entity;

import com.gemfinder.attractions.entity.Attraction;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@ToString
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(
        name = "gem_periods",
        indexes = {
                @Index(name = "idx_gem_periods_attraction_id", columnList = "attraction_id"),
                @Index(name = "idx_gem_periods_forecast_date", columnList = "forecast_date"),
                @Index(name = "idx_gem_attraction_time",       columnList = "attraction_id, start_time")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_gem_attraction_start",
                        columnNames = {"attraction_id", "start_time"})
        }
)
@EntityListeners(AuditingEntityListener.class)
public class GemPeriod {

    @EqualsAndHashCode.Include
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attraction_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gem_periods_attraction"))
    private Attraction attraction;

    @NotNull
    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @NotNull
    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    // 1-5 busyness level — used for colour coding on the chart
    @NotNull
    @Min(1) @Max(5)
    @Column(name = "busyness_level", nullable = false)
    private Short busynessLevel;

    // Raw model output — used as Y-axis on the bar chart
    @NotNull
    @Column(name = "predicted_dropoffs", nullable = false)
    private Double predictedDropoffs;

    @NotNull
    @Column(name = "forecast_date", nullable = false)
    private LocalDate forecastDate;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}