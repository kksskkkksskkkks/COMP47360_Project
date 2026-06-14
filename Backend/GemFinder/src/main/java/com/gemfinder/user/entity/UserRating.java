package com.gemfinder.user.entity;

import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.auth.entity.User;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = {"user", "attraction"})
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(
        name = "user_ratings",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_ratings_user_attraction",
                columnNames = {"user_id", "attraction_id"}
        )
)
@EntityListeners(AuditingEntityListener.class)
public class UserRating {

    @EqualsAndHashCode.Include
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_ratings_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attraction_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_ratings_attraction"))
    private Attraction attraction;

    // DECIMAL(3,1) avoids float precision issues; range validated here
    @NotNull
    @DecimalMin("0.0") @DecimalMax("5.0")
    @Column(nullable = false, precision = 3, scale = 1)
    private BigDecimal rating;

//    @Size(max = 2000)
//    @Column(columnDefinition = "TEXT")
//    private String comment;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
