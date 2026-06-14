package com.gemfinder.attractions.service;

import com.gemfinder.attractions.dto.AttractionDTO;
import com.gemfinder.attractions.entity.Attraction;
import com.gemfinder.attractions.mapper.AttractionMapper;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.attractions.service.AttractionService;
import com.gemfinder.attractions.spec.AttractionSpec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AttractionServiceImpl implements AttractionService {

    private final AttractionRepository attractionRepository;

    @Override
    @Transactional(readOnly = true)
    public AttractionDTO getById(Long id) {
        return attractionRepository.findById(id)
                .map(attraction -> AttractionMapper.toDTO(attraction))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Attraction not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AttractionDTO> search(String keyword, String category, Integer minWheelchair, Pageable pageable) {
        Specification<Attraction> spec = Specification
                .where(AttractionSpec.hasKeyword(keyword))
                .and(AttractionSpec.hasCategory(category))
                .and(AttractionSpec.hasWheelchairAtLeast(minWheelchair));

        return attractionRepository.findAll(spec, pageable)
                .map(attraction -> AttractionMapper.toDTO(attraction));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttractionDTO> getAllByZone(Integer zoneId) {
        return attractionRepository.findByZoneId(zoneId).stream()
                .map(attraction -> AttractionMapper.toDTO(attraction))
                .toList();
    }

    @Override
    @Transactional
    public void refreshRatingStats(Long attractionId) {
        Attraction attraction = attractionRepository.findById(attractionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Attraction not found with id: " + attractionId));

        // User ratings aggregation
        double userAvg = attractionRepository
                .findRatingAvgByAttractionId(attractionId)
                .orElse(0.0);
        int userCount = attractionRepository
                .findRatingCountByAttractionId(attractionId);

        // Original data from OSM/Google (preserved at import time)
        double originalAvg = attraction.getOriginalAvgRating();
        int originalCount = attraction.getOriginalRatingCount();

        // Merged weighted average
        int totalCount = originalCount + userCount;
        double mergedAvg = totalCount == 0 ? 0.0
                : (originalAvg * originalCount + userAvg * userCount) / totalCount;

        // Round to one decimal place to match DB column DECIMAL(3,1)
        double rounded = Math.round(mergedAvg * 10.0) / 10.0;

        attractionRepository.updateRatingStats(attractionId, rounded, totalCount);
        log.debug("Refreshed rating stats for attraction id={}: mergedAvg={}, totalCount={}",
                attractionId, rounded, totalCount);
    }
}