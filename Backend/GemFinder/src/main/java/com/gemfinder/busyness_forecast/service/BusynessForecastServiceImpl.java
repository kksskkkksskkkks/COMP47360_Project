package com.gemfinder.busyness_forecast.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;
import com.gemfinder.busyness_forecast.entity.BusynessForecast;
import com.gemfinder.busyness_forecast.mapper.BusynessForecastMapper;
import com.gemfinder.busyness_forecast.repository.BusynessForecastRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class BusynessForecastServiceImpl implements BusynessForecastService {

    private final BusynessForecastRepository forecastRepository;
    private final ObjectMapper objectMapper;

//    @Value("${gemfinder.flask.url:http://127.0.0.1:5001}")
//    private String flaskUrl;
//
//    private static final DateTimeFormatter SLOT_FMT =
//            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
//
//    @Override
//    @Transactional(readOnly = true)
//    public BusynessForecastDTO getForecast(Integer zoneId, LocalDateTime timeBucket) {
//        LocalDateTime slot = floorToSlot(timeBucket);
//
//        Optional<BusynessForecast> cached = forecastRepository
//                .findByZoneIdAndTimeBucket(zoneId, slot);
//
//        if (cached.isPresent()) {
//            log.debug("DB hit: zone={} slot={}", zoneId, slot);
//            return BusynessForecastMapper.toDTO(cached.get());
//        }
//
//        log.info("DB miss: zone={} slot={}, calling Flask fallback", zoneId, slot);
//        return callFlask(zoneId, slot);
//    }

    @Override
    @Transactional(readOnly = true)
    public BusynessForecastDTO getForecast(Integer zoneId, LocalDateTime timeBucket) {
        LocalDateTime slot = floorToSlot(timeBucket);

        return forecastRepository.findByZoneIdAndTimeBucket(zoneId, slot)
                .map(BusynessForecastDTO -> BusynessForecastMapper.toDTO(BusynessForecastDTO))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No forecast for zone=" + zoneId + " slot=" + slot));
    }

//    @Override
//    @Transactional(readOnly = true)
//    public List<BusynessForecastDTO> getForecast48h(Integer zoneId) {
//        LocalDateTime from = floorToSlot(LocalDateTime.now());
//        LocalDateTime to   = from.plusHours(48);
//
//        return forecastRepository.findByZoneIdAndTimeRange(zoneId, from, to)
//                .stream()
//                .map(BusynessForecastDTO -> BusynessForecastMapper.toDTO(BusynessForecastDTO))
//                .toList();
//    }

    @Override
    @Transactional(readOnly = true)
    public List<BusynessForecastDTO> getForecastRange(Integer zoneId, LocalDateTime from, LocalDateTime to) {
        LocalDateTime slotFrom = floorToSlot(from);
        LocalDateTime slotTo   = floorToSlot(to);

        return forecastRepository.findByZoneIdAndTimeRange(zoneId, slotFrom, slotTo)
                .stream()
                .map(BusynessForecastDTO -> BusynessForecastMapper.toDTO(BusynessForecastDTO))
                .toList();
    }


    @Override
    @Transactional(readOnly = true)
    public List<BusynessForecastDTO> getAllZonesAtTime(LocalDateTime timeBucket) {
        LocalDateTime slot = floorToSlot(timeBucket);

        return forecastRepository.findAllZonesByTimeBucket(slot)
                .stream()
                .map(BusynessForecastDTO -> BusynessForecastMapper.toDTO(BusynessForecastDTO))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BusynessForecastDTO> getAllZonesInRange(LocalDateTime from, LocalDateTime to) {
        return forecastRepository.findAllByTimeBucketBetween(from, to)
                .stream()
                .map(BusynessForecastMapper::toDTO)
                .toList();
    }

    // ── Private helpers ────────────────────────────────────────────

    /** Rounds down to the nearest 30-minute boundary, matching Flask .floor('30min'). */
    private LocalDateTime floorToSlot(LocalDateTime dt) {
        int minute = dt.getMinute() >= 30 ? 30 : 0;
        return dt.withMinute(minute).withSecond(0).withNano(0);
    }

//    /** Calls Flask /predict for real-time inference when DB has no cached result. */
//    private BusynessForecastDTO callFlask(Integer zoneId, LocalDateTime slot) {
//        try {
//            String body = String.format(
//                    "{\"zone_id\":%d,\"time_bucket\":\"%s\"}",
//                    zoneId, slot.format(SLOT_FMT));
//
//            HttpRequest request = HttpRequest.newBuilder()
//                    .uri(URI.create(flaskUrl + "/predict"))
//                    .header("Content-Type", "application/json")
//                    .POST(HttpRequest.BodyPublishers.ofString(body))
//                    .build();
//
//            HttpResponse<String> response = HttpClient.newHttpClient()
//                    .send(request, HttpResponse.BodyHandlers.ofString());
//
//            JsonNode json = objectMapper.readTree(response.body());
//
//            BusynessForecastDTO dto = new BusynessForecastDTO();
//            dto.setZoneId(zoneId);
//            dto.setTimeBucket(slot);
//            dto.setPredictedDropoffs(json.path("predicted_dropoffs").asDouble());
//            dto.setBusynessLevel(json.path("busyness_level").shortValue());
//            dto.setBusynessLevelRelative(json.path("busyness_level_relative").shortValue());
//            return dto;
//
//        } catch (Exception e) {
//            // Return a safe empty response rather than crashing the request
//            log.error("Flask fallback failed for zone={} slot={}: {}", zoneId, slot, e.getMessage());
//            BusynessForecastDTO dto = new BusynessForecastDTO();
//            dto.setZoneId(zoneId);
//            dto.setTimeBucket(slot);
//            dto.setPredictedDropoffs(0.0);
//            dto.setBusynessLevel((short) 0);
//            dto.setBusynessLevelRelative((short) 0);
//            return dto;
//        }
//    }
}
