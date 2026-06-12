package com.gemfinder.user.entity;

import com.gemfinder.auth.entity.User;
import com.gemfinder.attractions.entity.Attraction;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = {"user", "attraction"})
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(
        name = "user_checkins",
        indexes = {
//                @Index(name = "idx_checkins_user_id",       columnList = "user_id"),
                @Index(name = "idx_checkins_user_attraction", columnList = "user_id, attraction_id"),
                @Index(name = "idx_checkins_attraction_id", columnList = "attraction_id")
        }
)
@EntityListeners(AuditingEntityListener.class)
public class UserCheckin {

    @EqualsAndHashCode.Include
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_checkins_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attraction_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_checkins_attraction"))
    private Attraction attraction;

    // nullable snapshot; range 0–5 validated by service layer
    @Min(0) @Max(5)
    @Column(name = "busyness_at_visit")
    private Short busynessAtVisit;

//    @Size(max = 1000)
//    @Column(columnDefinition = "TEXT")
//    private String note;

    // always set server-side; never accepted from frontend
    @CreatedDate
    @Column(name = "visited_at", nullable = false, updatable = false)
    private Instant visitedAt;
}

