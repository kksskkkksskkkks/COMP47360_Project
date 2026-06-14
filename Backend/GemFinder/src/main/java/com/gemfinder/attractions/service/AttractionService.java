package com.gemfinder.attractions.service;

import com.gemfinder.attractions.dto.AttractionDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface AttractionService {

    // ── Single-record lookup ───────────────────────────────────────────

    /** Finds an attraction by primary key; throws 404 if absent. */
    AttractionDTO getById(Long id);

    // ── Filtered paginated query ───────────────────────────────────────

    /**
     * Returns a filtered, paginated list of attractions.
     * All parameters are optional and can be combined freely.
     *
     * @param keyword   partial name match (case-insensitive), or null
     * @param category  exact category match, or null
     * @param minWheelchair minimum wheelchair level (0/1/2), or null
     */
    Page<AttractionDTO> search(String keyword, String category, Integer minWheelchair, Pageable pageable);

    /**
     * Returns all attractions in the given zone without pagination.
     * Intended for map rendering.
     */
    List<AttractionDTO> getAllByZone(Integer zoneId);

    // ── Internal API (called by other services) ────────────────────────

    /**
     * Recomputes and persists avgRating and ratingCount for the given attraction.
     * Must be called by UserRatingService after any rating is created, updated, or deleted.
     */
    void refreshRatingStats(Long attractionId);
}