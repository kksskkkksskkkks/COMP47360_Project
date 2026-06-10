package com.gemfinder.controller;


import com.gemfinder.dto.ApiResponse;
import com.gemfinder.dto.AttractionDTO;
import com.gemfinder.dto.AttractionQuery;
import com.gemfinder.dto.PageResult;
import com.gemfinder.service.AttractionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for attraction-related endpoints.
 *
 * Endpoints:
 *   GET /api/attractions             — paginated, filtered list
 *   GET /api/attractions/{id}        — single attraction with live busyness
 *   GET /api/attractions/categories  — distinct category values for the filter UI
 */
@RestController
@RequestMapping("/api/attractions")
@RequiredArgsConstructor
public class AttractionController {

    private final AttractionService attractionService;

    /**
     * Returns a paginated list of attractions.
     *
     * Query params:
     *   category   — filter by category name (optional)
     *   wheelchair — true to return only accessible attractions (optional)
     *   page       — page number, 1-based (default 1)
     *   size       — page size, max 100 (default 20)
     *
     * Example: GET /api/attractions?category=museum&wheelchair=true&page=1&size=10
     */
    @GetMapping
    public ApiResponse<PageResult<AttractionDTO>> list(AttractionQuery query) {
        return ApiResponse.success(attractionService.getAttractions(query));
    }

    /**
     * Returns a single attraction with live busyness data injected from Flask.
     *
     * Example: GET /api/attractions/42
     */
    @GetMapping("/{id}")
    public ApiResponse<AttractionDTO> detail(@PathVariable Long id) {
        return ApiResponse.success(attractionService.getAttractionById(id));
    }

    /**
     * Returns all distinct category values sorted alphabetically.
     * Used to populate the filter dropdown on the Discover page.
     *
     * Example: GET /api/attractions/categories
     */
    @GetMapping("/categories")
    public ApiResponse<List<String>> categories() {
        return ApiResponse.success(attractionService.getCategories());
    }
}
