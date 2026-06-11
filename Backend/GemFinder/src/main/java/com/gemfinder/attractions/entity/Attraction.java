package com.gemfinder.attractions.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@ToString
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(
        name = "attractions",
        indexes = {
                @Index(name = "idx_attractions_zone_id",  columnList = "zone_id"),
                @Index(name = "idx_attractions_category", columnList = "category")
        }
)
@EntityListeners(AuditingEntityListener.class)
public class Attraction {

    @EqualsAndHashCode.Include
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(name = "osm_id", length = 64, nullable = false, unique = true)
    private String osmId;

    @NotBlank
    @Column(nullable = false, length = 255)
    private String name;

    @NotBlank
    @Column(nullable = false, length = 64)
    private String category;

    @Column(name = "osm_group", length = 64)
    private String osmGroup;

    @NotNull
    @DecimalMin("-90.0") @DecimalMax("90.0")
    @Column(nullable = false)
    private Double lat;

    @NotNull
    @DecimalMin("-180.0") @DecimalMax("180.0")
    @Column(nullable = false)
    private Double lon;

    @Column(name = "opening_hours", length = 512)
    private String openingHours;

    @Column(name = "opening_hours_source", length = 32)
    private String openingHoursSource;

    // 0 = no, 1 = partial, 2 = yes
    @Min(0) @Max(2)
    @NotNull
    @Column(nullable = false)
    private Integer wheelchair = 0;

    @Column(name = "avg_rating", nullable = false)
    private Double avgRating = 0.0;

    @PositiveOrZero
    @Column(name = "rating_count", nullable = false)
    private Integer ratingCount = 0;

    @NotNull
    @Column(name = "zone_id", nullable = false)
    private Integer zoneId;

    @Positive
    @Column(name = "suggested_duration_min")
    private Integer suggestedDurationMin;

    @Column(name = "image_path", length = 512)
    private String imagePath;

    @Column(name = "image_source", length = 32)
    private String imageSource;

    @Column(name = "image_is_fallback", nullable = false)
    private Boolean imageIsFallback = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}