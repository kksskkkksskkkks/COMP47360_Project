package com.gemfinder.attractions.service.impl;

import com.gemfinder.attractions.dto.AttractionDTO;
import com.gemfinder.attractions.mapper.AttractionMapper;
import com.gemfinder.attractions.repository.AttractionRepository;
import com.gemfinder.attractions.service.AttractionService;
import com.gemfinder.attractions.spec.AttractionSpec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.gemfinder.attractions.entity.Attraction;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
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

//    @Override
//    @Transactional(readOnly = true)
//    public List<AttractionDTO> getAllByZone(Integer zoneId) {
//        return attractionRepository.findByZoneId(zoneId).stream()
//                .map(attraction -> AttractionMapper.toDTO(attraction))
//                .toList();
//    }

    @Override
    @Transactional(readOnly = true)
    public List<AttractionDTO> getAllByZone(Integer zoneId) {
        List<Attraction> entities = attractionRepository.findByZoneId(zoneId);
        List<AttractionDTO> result = new ArrayList<>();
        for (Attraction a : entities) {
            result.add(AttractionMapper.toDTO(a));
        }
        return result;
    }


    @Override
    @Transactional
    public void refreshRatingStats(Long attractionId) {
        if (!attractionRepository.existsById(attractionId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Attraction not found with id: " + attractionId);
        }

        double avg = attractionRepository
                .findRatingAvgByAttractionId(attractionId)
                .orElse(0.0);
        int count = attractionRepository
                .findRatingCountByAttractionId(attractionId);

        // Round to one decimal place to match DB column DECIMAL(3,1)
        double rounded = Math.round(avg * 10.0) / 10.0;

        attractionRepository.updateRatingStats(attractionId, rounded, count);
        log.debug("Refreshed rating stats for attraction id={}: avg={}, count={}",
                attractionId, rounded, count);
    }
}