package com.gemfinder.weather_chatbot.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Cache configuration for the weather chatbot.
 *
 * Open-Meteo updates its data every ~15 minutes, so a 10-minute TTL
 * ensures freshness while eliminating redundant HTTP calls within
 * the same conversation session.
 *
 * Cache name : "manhattan-weather"
 * TTL        : 10 minutes (write-based expiry)
 * Max entries: 1 (Manhattan is the only location)
 */
@EnableCaching
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager("manhattan-weather");
        manager.setCaffeine(
                Caffeine.newBuilder()
                        .expireAfterWrite(60, TimeUnit.MINUTES)
                        .maximumSize(1)
        );
        return manager;
    }
}
