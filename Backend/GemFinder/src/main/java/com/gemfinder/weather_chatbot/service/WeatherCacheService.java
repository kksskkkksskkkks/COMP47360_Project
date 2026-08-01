package com.gemfinder.weather_chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Dedicated cache layer for Open-Meteo weather data.
 *
 * Extracted into its own Spring bean so that @Cacheable works correctly —
 * Spring AOP cannot intercept private or self-invoked methods, so the
 * cached method must live in a separate proxied bean.
 *
 * Cache : "manhattan-weather"
 * TTL   : 10 minutes (configured in CacheConfig)
 *
 * <p>A scheduled task proactively refetches the data every 10 minutes and
 * writes it straight into the cache, so users never hit a cold cache miss
 * and pay the Open-Meteo network round-trip themselves. Note this task
 * calls the manual cache-put path below rather than the {@code @Cacheable}
 * method directly — calling an {@code @Cacheable} method from within the
 * same class ("self-invocation") bypasses the Spring AOP proxy entirely,
 * so the result would silently NOT be cached.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherCacheService {

    private static final String CACHE_NAME = "manhattan-weather";
    private static final String CACHE_KEY  = "manhattan";

    private static final String FORECAST_URL =
            "https://api.open-meteo.com/v1/forecast"
                    + "?latitude=40.7831"
                    + "&longitude=-73.9712"
                    + "&timezone=America%2FNew_York"
                    + "&temperature_unit=fahrenheit"
                    + "&wind_speed_unit=mph"
                    + "&precipitation_unit=inch"
                    + "&current=temperature_2m,apparent_temperature,weather_code,"
                    +          "wind_speed_10m,relative_humidity_2m"
                    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,"
                    +        "apparent_temperature_max,apparent_temperature_min,"
                    +        "precipitation_sum,precipitation_probability_max,"
                    +        "wind_speed_10m_max,uv_index_max"
                    + "&forecast_days=2";

    private final ObjectMapper objectMapper;
    private final CacheManager cacheManager;

    /**
     * Returns the raw Open-Meteo JSON for Manhattan.
     *
     * On the first call (or after cache expiry) this hits the network.
     * All subsequent calls within the TTL window return the cached result.
     * The cache key is the fixed string "manhattan" — only one entry ever exists.
     */
    @Cacheable(value = CACHE_NAME, key = "'" + CACHE_KEY + "'", sync = true)
    public JsonNode getRawWeather() {
        return fetchFromOpenMeteo();
    }

    /**
     * Proactively refetches Open-Meteo and writes the result straight into
     * the cache, every 10 minutes — matching the cache TTL exactly, so the
     * entry is always replaced just as (or just before) it would expire.
     *
     * <p>Because this writes directly via {@link CacheManager#getCache},
     * it does NOT go through the {@code @Cacheable} proxy, which is exactly
     * what we want here: we always want a fresh network call on this
     * schedule, never a cache hit.
     *
     * <p>If Open-Meteo is briefly unreachable, the old cached value (if any)
     * is left untouched and will simply be retried on the next tick —
     * users keep getting the last-known-good data instead of an error.
     */
    @Scheduled(fixedDelay = 9 * 60 * 1000)
    public void refreshWeatherCache() {
        try {
            log.debug("Proactively refreshing {} cache", CACHE_NAME);
            JsonNode fresh = fetchFromOpenMeteo();

            Cache cache = cacheManager.getCache(CACHE_NAME);
            if (cache != null) {
                cache.put(CACHE_KEY, fresh);
            }
        } catch (Exception e) {
            // Don't let a failed background refresh take down the scheduler
            // or wipe a still-valid cached value — just log and retry next tick.
            log.warn("Scheduled weather cache refresh failed, keeping stale value: {}",
                    e.getMessage());
        }
    }

    /**
     * Plain (uncached) network call to Open-Meteo. Shared by both the
     * {@code @Cacheable} entry point and the scheduled proactive refresh,
     * so there is exactly one place that knows how to talk to Open-Meteo.
     */
    private JsonNode fetchFromOpenMeteo() {
        try {
            log.info("Fetching Manhattan weather from Open-Meteo");
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(FORECAST_URL))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> resp = HttpClient.newHttpClient()
                    .send(req, HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() != 200) {
                throw new RuntimeException("HTTP " + resp.statusCode());
            }

            return objectMapper.readTree(resp.body());

        } catch (Exception e) {
            log.error("Open-Meteo request failed: {}", e.getMessage(), e);
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not fetch Manhattan weather: " + e.getMessage());
        }
    }
}