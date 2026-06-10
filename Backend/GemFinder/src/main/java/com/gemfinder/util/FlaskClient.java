package com.gemfinder.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * HTTP client for the Flask model-serving service (app.py).
 *
 * Endpoints used:
 *   POST /predict        — single-zone busyness for the current 30-min slot
 *   POST /predict/batch  — multi-zone batch query for the heat map
 *   GET  /health         — liveness check
 *
 * Flask selects DB first, falls back to real-time LightGBM inference automatically,
 * so Spring Boot does not need to know about that distinction.
 *
 * All methods return null / empty on any network or parsing error so callers
 * can decide whether to surface the failure or silently omit busyness data.
 */
@Slf4j
@Component
public class FlaskClient {

    private static final DateTimeFormatter SLOT_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final RestTemplate restTemplate;

    public FlaskClient(@Qualifier("flaskRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    // ── Single zone ──────────────────────────────────────────────────────────

    /**
     * Fetches the busyness forecast for one TLC zone at the current 30-minute slot.
     *
     * Calls POST /predict with a minimal body — weather fields are omitted so Flask
     * uses its pre-computed DB values; real-time inference is the automatic fallback.
     *
     * Flask response shape:
     * {
     *   "zone_id": 132,
     *   "time_bucket": "2026-06-08T14:00:00",
     *   "predicted_dropoffs": 87.3,
     *   "busyness_level": 3,
     *   "busyness_level_relative": 2,
     *   "source": "db" | "realtime"
     * }
     *
     * @param zoneId TLC Manhattan zone ID from {@code attractions.zone_id}
     * @return Flask response as a map, or {@code null} on failure
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getBusyness(int zoneId) {
        String timeBucket = currentSlot();
        Map<String, Object> body = new HashMap<>();
        body.put("zone_id",     zoneId);
        body.put("time_bucket", timeBucket);

        try {
            ResponseEntity<Map> resp = restTemplate.postForEntity("/predict", body, Map.class);
            return resp.getBody();
        } catch (RestClientException e) {
            log.warn("Flask /predict failed for zone={} ts={}: {}", zoneId, timeBucket, e.getMessage());
            return null;
        }
    }

    // ── Batch (heat map) ─────────────────────────────────────────────────────

    /**
     * Fetches busyness for multiple zones at a given time slot in a single call.
     * Intended for the heat map page, which needs all Manhattan zones at once.
     *
     * Calls POST /predict/batch.
     *
     * Flask request shape:
     * { "requests": [ {"zone_id": 132, "time_bucket": "..."}, ... ] }
     *
     * Flask response shape:
     * { "results": [ {"zone_id": 132, "busyness_level": 3, ...}, ... ] }
     *
     * @param zoneIds     list of TLC zone IDs to query
     * @param timeBucket  ISO-8601 datetime string, e.g. "2026-06-08T14:00:00"
     * @return list of per-zone result maps, or {@code null} on failure
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getBusynessBatch(List<Integer> zoneIds, String timeBucket) {
        List<Map<String, Object>> requests = zoneIds.stream()
                .map(zoneId -> {
                    Map<String, Object> req = new HashMap<>();
                    req.put("zone_id",     zoneId);
                    req.put("time_bucket", timeBucket);
                    return req;
                })
                .toList();

        Map<String, Object> body = Map.of("requests", requests);

        try {
            ResponseEntity<Map> resp = restTemplate.postForEntity("/predict/batch", body, Map.class);
            if (resp.getBody() == null) return null;
            return (List<Map<String, Object>>) resp.getBody().get("results");
        } catch (RestClientException e) {
            log.warn("Flask /predict/batch failed for {} zones at {}: {}",
                    zoneIds.size(), timeBucket, e.getMessage());
            return null;
        }
    }

    // ── Health ───────────────────────────────────────────────────────────────

    /**
     * Calls Flask GET /health and returns true if Flask and its DB connection are up.
     * Used by the Spring Boot health endpoint to report downstream status.
     */
    @SuppressWarnings("unchecked")
    public boolean isHealthy() {
        try {
            ResponseEntity<Map> resp = restTemplate.getForEntity("/health", Map.class);
            if (resp.getBody() == null) return false;
            return "ok".equals(resp.getBody().get("status"));
        } catch (RestClientException e) {
            log.warn("Flask health check failed: {}", e.getMessage());
            return false;
        }
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    /**
     * Returns the current time floored to the nearest 30-minute slot,
     * formatted as an ISO-8601 string matching Flask's expected input.
     * e.g. "2026-06-08T14:00:00" or "2026-06-08T14:30:00"
     */
    private String currentSlot() {
        LocalDateTime now     = LocalDateTime.now();
        int           minutes = (now.getMinute() / 30) * 30;  // floor to 0 or 30
        LocalDateTime slot    = now.withMinute(minutes).withSecond(0).withNano(0);
        return slot.format(SLOT_FMT);
    }
}
