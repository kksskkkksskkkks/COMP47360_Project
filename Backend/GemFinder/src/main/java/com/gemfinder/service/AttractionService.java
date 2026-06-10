package com.gemfinder.service;

import com.gemfinder.dto.AttractionDTO;
import com.gemfinder.dto.AttractionQuery;
import com.gemfinder.dto.PageResult;
import com.gemfinder.entity.Attraction;
import com.gemfinder.exception.ResourceNotFoundException;
import com.gemfinder.mapper.AttractionMapper;
import com.gemfinder.util.FlaskClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class AttractionService {

    private final AttractionMapper attractionMapper;
    private final FlaskClient      flaskClient;
    private final RedisTemplate<String, Object> redisTemplate;
    private final JdbcTemplate     jdbcTemplate;

    // ── Redis key prefixes ───────────────────────────────────────────────────

    /** Base attraction data (static fields, no busyness). */
    private static final String KEY_DETAIL     = "attraction:detail:";

    /** Distinct category list for the filter dropdown. */
    private static final String KEY_CATEGORIES = "attraction:categories";

    /**
     * Per-zone busyness for a specific 30-minute slot.
     * Full key: "busyness:{zoneId}:{slot}", e.g. "busyness:132:2026-06-09T14:30:00"
     */
    private static final String KEY_BUSYNESS = "busyness:";

    // ── Cache TTLs ───────────────────────────────────────────────────────────

    /** Attraction base data is stable; 30 minutes is conservative. */
    private static final long DETAIL_TTL_SECONDS     = 60 * 30;   // 30 min

    /** Categories only change when an admin imports new data. */
    private static final long CATEGORIES_TTL_SECONDS = 60 * 60;   // 60 min

    // ── Formatters ───────────────────────────────────────────────────────────

    private static final DateTimeFormatter SLOT_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    // ════════════════════════════════════════════════════════════════════════
    // Public API
    // ════════════════════════════════════════════════════════════════════════

    // ── List ─────────────────────────────────────────────────────────────────

    /**
     * Returns a paginated, filtered list of attractions with busyness data attached.
     *
     * <p>List results are NOT cached because they vary by filter combination
     * and page number; the DB query with an index on avg_rating is fast enough.
     *
     * <p>Busyness is resolved in bulk for the entire page in a single pass:
     * one Redis multiGet, at most one DB IN-query for misses, and at most one
     * Flask batch call for any remaining misses. This keeps the per-page overhead
     * to O(1) network round-trips regardless of page size.
     */
    public PageResult<AttractionDTO> getAttractions(AttractionQuery query) {
        // Clamp inputs to prevent abuse
        if (query.getSize() > 100) query.setSize(100);
        if (query.getPage() < 1)   query.setPage(1);

        List<Attraction> rows  = attractionMapper.findAll(query);
        long             total = attractionMapper.countAll(query);

        List<AttractionDTO> dtos = rows.stream()
                .map(this::toDTO)
                .toList();

        // Inject busyness for the whole page in one batch
        injectBusynessBatch(dtos);

        return new PageResult<>(dtos, total, query.getPage(), query.getSize());
    }

    // ── Detail ───────────────────────────────────────────────────────────────

    /**
     * Returns a single attraction with live busyness data attached.
     *
     * <p>Caching strategy:
     * <ol>
     *   <li>Base attraction data is cached in Redis for 30 minutes (it rarely changes).</li>
     *   <li>Busyness is resolved separately via a three-layer lookup each time:
     *       Redis → busyness_forecast table → Flask real-time inference.</li>
     * </ol>
     *
     * <p>The two concerns are kept separate because their update frequencies differ:
     * attraction metadata is stable, while busyness changes every 30 minutes.
     *
     * @throws ResourceNotFoundException if no attraction exists with the given id
     */
    public AttractionDTO getAttractionById(Long id) {
        String cacheKey = KEY_DETAIL + id;

        // 1. Try Redis for base attraction data
        AttractionDTO cached = (AttractionDTO) redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            log.debug("Attraction cache hit id={}", id);
            injectBusyness(cached);
            return cached;
        }

        // 2. Redis miss — query the DB
        Attraction attraction = attractionMapper.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attraction not found: " + id));

        AttractionDTO dto = toDTO(attraction);

        // 3. Cache base DTO (without busyness — busyness has its own cache lifecycle)
        redisTemplate.opsForValue().set(cacheKey, dto, DETAIL_TTL_SECONDS, TimeUnit.SECONDS);

        // 4. Attach live busyness and return
        injectBusyness(dto);
        return dto;
    }

    // ── Categories ───────────────────────────────────────────────────────────

    /**
     * Returns all distinct category values sorted alphabetically.
     * Cached for 60 minutes; new categories only appear after an admin import.
     */
    @SuppressWarnings("unchecked")
    public List<String> getCategories() {
        List<String> cached = (List<String>) redisTemplate.opsForValue().get(KEY_CATEGORIES);
        if (cached != null) return cached;

        List<String> categories = attractionMapper.findAllCategories();
        redisTemplate.opsForValue().set(KEY_CATEGORIES, categories, CATEGORIES_TTL_SECONDS, TimeUnit.SECONDS);
        return categories;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Busyness — batch (list page)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Injects busyness data into every DTO in the list using at most three
     * bulk operations: one Redis multiGet, one DB IN-query, one Flask batch call.
     *
     * <p>Algorithm:
     * <ol>
     *   <li>Collect distinct zone IDs from the page (DTOs with null zoneId are skipped).</li>
     *   <li>Redis multiGet — build a resolved map for cache hits.</li>
     *   <li>DB IN-query — fill in the remaining zones from busyness_forecast.</li>
     *   <li>Flask /predict/batch — fill in any zones still unresolved.</li>
     *   <li>Write all newly resolved entries back to Redis in a single pipeline.</li>
     *   <li>Apply the resolved map to every DTO.</li>
     * </ol>
     *
     * <p>If a zone cannot be resolved at any layer its busyness fields stay {@code null}.
     */
    private void injectBusynessBatch(List<AttractionDTO> dtos) {
        String slot = currentSlot();

        // Collect distinct zone IDs that have a value (skip nulls)
        List<Integer> zoneIds = dtos.stream()
                .map(AttractionDTO::getZoneId)
                .filter(z -> z != null)
                .distinct()
                .toList();

        if (zoneIds.isEmpty()) return;

        // resolved: zoneId → {busyness_level, busyness_level_relative}
        Map<Integer, Map<?, ?>> resolved = new HashMap<>();

        // ── Layer 1: Redis multiGet ──────────────────────────────────────────
        List<String> redisKeys = zoneIds.stream()
                .map(z -> KEY_BUSYNESS + z + ":" + slot)
                .toList();

        try {
            List<Object> cached = redisTemplate.opsForValue().multiGet(redisKeys);
            if (cached != null) {
                IntStream.range(0, zoneIds.size()).forEach(i -> {
                    Object v = cached.get(i);
                    if (v instanceof Map<?, ?> m) {
                        resolved.put(zoneIds.get(i), m);
                    }
                });
            }
            log.debug("Busyness batch Redis hits: {}/{}", resolved.size(), zoneIds.size());
        } catch (Exception e) {
            log.warn("Redis multiGet failed for busyness batch: {}", e.getMessage());
        }

        // Zones not yet resolved after Redis
        List<Integer> missingAfterRedis = zoneIds.stream()
                .filter(z -> !resolved.containsKey(z))
                .toList();

        // ── Layer 2: DB IN-query ─────────────────────────────────────────────
        if (!missingAfterRedis.isEmpty()) {
            Map<Integer, Map<?, ?>> dbResults = queryBusynessBatchFromDB(missingAfterRedis, slot);
            resolved.putAll(dbResults);
            log.debug("Busyness batch DB hits: {}/{}", dbResults.size(), missingAfterRedis.size());
        }

        // Zones still unresolved after DB
        List<Integer> missingAfterDB = zoneIds.stream()
                .filter(z -> !resolved.containsKey(z))
                .toList();

        // ── Layer 3: Flask /predict/batch ────────────────────────────────────
        if (!missingAfterDB.isEmpty()) {
            log.debug("Busyness batch Flask fallback for {} zones", missingAfterDB.size());
            List<Map<String, Object>> flaskResults =
                    flaskClient.getBusynessBatch(missingAfterDB, slot);

            if (flaskResults != null) {
                for (Map<String, Object> r : flaskResults) {
                    Object zObj = r.get("zone_id");
                    if (zObj instanceof Number n) {
                        resolved.put(n.intValue(), r);
                    }
                }
            }
        }

        // ── Write newly resolved entries back to Redis ───────────────────────
        // Only write zones that were NOT in Redis originally (avoid redundant writes)
        Set<Integer> redisHits = zoneIds.stream()
                .filter(z -> !missingAfterRedis.contains(z))
                .collect(Collectors.toSet());

        try {
            long ttl = slotRemainingSeconds();
            redisTemplate.executePipelined((org.springframework.data.redis.core.RedisCallback<Object>) conn -> {
                resolved.forEach((zoneId, data) -> {
                    if (!redisHits.contains(zoneId)) {
                        String key = KEY_BUSYNESS + zoneId + ":" + slot;
                        // Delegate to the non-pipelined template to handle serialization,
                        // then use the pipelined connection for the actual SET + EXPIRE.
                        redisTemplate.opsForValue().set(key, data, ttl, TimeUnit.SECONDS);
                    }
                });
                return null;
            });
        } catch (Exception e) {
            // Non-fatal: data is still served; it just won't be cached this request
            log.warn("Redis pipeline write failed for busyness batch: {}", e.getMessage());
        }

        // ── Apply resolved busyness to every DTO ─────────────────────────────
        for (AttractionDTO dto : dtos) {
            if (dto.getZoneId() == null) continue;
            Map<?, ?> data = resolved.get(dto.getZoneId());
            if (data != null) applyBusyness(dto, data);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Busyness — single (detail page)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Resolves the current busyness for one attraction's TLC zone and writes
     * the two busyness fields onto the DTO.
     *
     * <p>Lookup order: Redis → busyness_forecast table → Flask /predict.
     * If all three layers fail the busyness fields are left {@code null} (silent degradation).
     */
    private void injectBusyness(AttractionDTO dto) {
        if (dto.getZoneId() == null) return;

        int    zoneId = dto.getZoneId();
        String slot   = currentSlot();

        // ── Layer 1: Redis ───────────────────────────────────────────────────
        String redisKey = KEY_BUSYNESS + zoneId + ":" + slot;
        try {
            Object cached = redisTemplate.opsForValue().get(redisKey);
            if (cached instanceof Map<?, ?> m) {
                applyBusyness(dto, m);
                log.debug("Busyness Redis hit zone={} slot={}", zoneId, slot);
                return;
            }
        } catch (Exception e) {
            // Redis failure is non-fatal — continue to DB
            log.warn("Redis read failed for busyness zone={}: {}", zoneId, e.getMessage());
        }

        // ── Layer 2: busyness_forecast table ─────────────────────────────────
        Map<String, Object> busyness = queryBusynessFromDB(zoneId, slot);

        // ── Layer 3: Flask /predict (fallback) ───────────────────────────────
        if (busyness == null) {
            log.debug("DB miss for busyness zone={} slot={}, falling back to Flask", zoneId, slot);
            busyness = flaskClient.getBusyness(zoneId);
        }

        // All three layers failed — degrade silently
        if (busyness == null) {
            log.debug("Busyness unavailable for zone={} slot={}", zoneId, slot);
            return;
        }

        // Cache the resolved result; TTL expires at the next slot boundary
        try {
            long ttl = slotRemainingSeconds();
            redisTemplate.opsForValue().set(redisKey, busyness, ttl, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("Redis write failed for busyness zone={}: {}", zoneId, e.getMessage());
        }

        applyBusyness(dto, busyness);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Private helpers
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Batch-queries {@code busyness_forecast} for multiple zones at the given slot
     * using a single {@code IN} clause.
     *
     * @return map of zoneId → result row; zones with no data are absent from the map
     */
    private Map<Integer, Map<?, ?>> queryBusynessBatchFromDB(List<Integer> zoneIds, String slot) {
        if (zoneIds.isEmpty()) return Collections.emptyMap();

        String placeholders = zoneIds.stream()
                .map(z -> "?")
                .collect(Collectors.joining(", "));
        String sql = String.format("""
                SELECT zone_id, busyness_level, busyness_level_relative
                FROM   busyness_forecast
                WHERE  zone_id     IN (%s)
                  AND  time_bucket = ?
                """, placeholders);

        // Build the parameter array: all zone IDs followed by the slot string
        List<Object> params = new ArrayList<>(zoneIds);
        params.add(slot);

        try {
            List<Map<String, Object>> rows =
                    jdbcTemplate.queryForList(sql, params.toArray());

            Map<Integer, Map<?, ?>> result = new HashMap<>();
            for (Map<String, Object> row : rows) {
                Object zObj = row.get("zone_id");
                if (zObj instanceof Number n) {
                    result.put(n.intValue(), row);
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("DB batch query failed for busyness zones={} slot={}: {}",
                    zoneIds, slot, e.getMessage());
            return Collections.emptyMap();
        }
    }

    /**
     * Single-zone DB lookup for the detail endpoint.
     *
     * @return a map with keys {@code busyness_level} and {@code busyness_level_relative},
     *         or {@code null} if no row exists or the query fails
     */
    private Map<String, Object> queryBusynessFromDB(int zoneId, String slot) {
        String sql = """
                SELECT busyness_level, busyness_level_relative
                FROM   busyness_forecast
                WHERE  zone_id     = ?
                  AND  time_bucket = ?
                """;
        try {
            return jdbcTemplate.queryForMap(sql, zoneId, slot);
        } catch (EmptyResultDataAccessException e) {
            // Normal path: the batch job has not written this slot yet
            return null;
        } catch (Exception e) {
            log.warn("DB query failed for busyness zone={} slot={}: {}",
                    zoneId, slot, e.getMessage());
            return null;
        }
    }

    /**
     * Writes the two busyness integers from {@code m} onto the DTO.
     * Accepts maps from all three sources (Redis, DB, Flask) — they all use
     * the same key names, so no per-source branching is needed.
     */
    private void applyBusyness(AttractionDTO dto, Map<?, ?> m) {
        Object level    = m.get("busyness_level");
        Object relative = m.get("busyness_level_relative");
        if (level    instanceof Number n) dto.setBusynessLevel(n.intValue());
        if (relative instanceof Number n) dto.setBusynessLevelRelative(n.intValue());
    }

    /**
     * Converts an {@link Attraction} entity to the frontend-facing DTO.
     * Internal fields (osm_id, image_is_fallback, etc.) are intentionally omitted.
     */
    private AttractionDTO toDTO(Attraction a) {
        AttractionDTO dto = new AttractionDTO();
        dto.setId(a.getId());
        dto.setName(a.getName());
        dto.setCategory(a.getCategory());
        dto.setLat(a.getLat());
        dto.setLon(a.getLon());
        dto.setOpeningHours(a.getOpeningHours());
        dto.setWheelchair(a.getWheelchair());
        dto.setAvgRating(a.getAvgRating());
        dto.setRatingCount(a.getRatingCount());
        dto.setZoneId(a.getZoneId());
        dto.setSuggestedDurationMin(a.getSuggestedDurationMin());
        dto.setImagePath(a.getImagePath());
        return dto;
    }

    /**
     * Returns the current time floored to the nearest 30-minute boundary,
     * formatted as an ISO-8601 string matching the {@code busyness_forecast.time_bucket} column.
     *
     * <p>Examples: {@code "2026-06-09T14:00:00"}, {@code "2026-06-09T14:30:00"}
     */
    private static String currentSlot() {
        LocalDateTime now     = LocalDateTime.now();
        int           minutes = (now.getMinute() / 30) * 30;
        LocalDateTime slot    = now.withMinute(minutes).withSecond(0).withNano(0);
        return slot.format(SLOT_FMT);
    }

    /**
     * Returns the number of seconds remaining in the current 30-minute slot.
     * Used as the Redis TTL so cached busyness entries expire at the slot boundary.
     *
     * <p>A floor of 10 seconds is applied to avoid a near-zero TTL that would
     * cause every request in the last few seconds of a slot to bypass the cache.
     */
    private static long slotRemainingSeconds() {
        long elapsed = Instant.now().getEpochSecond() % 1800;
        return Math.max(1800 - elapsed, 10);
    }
}


