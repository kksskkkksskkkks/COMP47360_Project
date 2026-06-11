package com.gemfinder.heat_map.entity;

import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
@Embeddable
@ToString
public class BusynessForecastId implements Serializable {

    private Integer zoneId;
    private LocalDateTime timeBucket;
}