package com.gemfinder.attractions.controller;

import com.gemfinder.attractions.dto.AttractionDTO;
import com.gemfinder.attractions.service.AttractionService;
import com.gemfinder.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/attractions")
@RequiredArgsConstructor
public class AttractionController {

    private final AttractionService attractionService;

    // GET /api/attractions/{id}
    @GetMapping("/{id}")
    public ApiResponse<AttractionDTO> getById(@PathVariable Long id) {
        return ApiResponse.success(attractionService.getById(id));
    }

    // GET /api/attractions?keyword=xxx&category=museum&wheelchair=1&page=0&size=20
    @GetMapping
    public ApiResponse<Page<AttractionDTO>> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer wheelchair,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success(attractionService.search(keyword, category, wheelchair, pageable));
    }

    // GET /api/attractions/zone/{zoneId}
    @GetMapping("/zone/{zoneId}")
    public ApiResponse<List<AttractionDTO>> getAllByZone(@PathVariable Integer zoneId) {
        return ApiResponse.success(attractionService.getAllByZone(zoneId));
    }
}