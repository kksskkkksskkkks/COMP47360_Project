package com.gemfinder.weather_chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gemfinder.weather_chatbot.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.http.HttpStatus;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// WeatherCacheService handles the @Cacheable layer (separate bean required for Spring AOP proxy)

/**
 * Weather chatbot implementation fixed to Manhattan, New York City.
 *
 * <p><b>Coordinates:</b> 40.7831°N, 73.9712°W (Central Park / Midtown).
 * One Open-Meteo grid cell covers the whole borough — no geocoding needed.
 *
 * <p><b>What the single Open-Meteo call returns:</b>
 * <pre>
 *   current:
 *     temperature_2m          → CurrentWeatherDTO.temperature        (°F, for "72°" card)
 *     apparent_temperature    → CurrentWeatherDTO.apparentTemperature (°F)
 *     weather_code            → CurrentWeatherDTO.weatherCode / weatherDescription
 *     wind_speed_10m          → CurrentWeatherDTO.windSpeed           (mph)
 *     relative_humidity_2m    → CurrentWeatherDTO.relativeHumidity    (%)
 *
 *   daily [index 0 = today, 1 = tomorrow]:
 *     temperature_2m_max/min  → WeatherForecastDTO.tempMax/tempMin   (°F)
 *     apparent_temperature_max/min → WeatherForecastDTO.apparentTempMax/Min
 *     precipitation_sum       → WeatherForecastDTO.precipitationSum  (inches)
 *     precipitation_probability_max → WeatherForecastDTO.precipitationProbabilityMax (%)
 *     wind_speed_10m_max      → WeatherForecastDTO.windSpeedMax      (mph)
 *     uv_index_max            → WeatherForecastDTO.uvIndexMax
 *     weather_code            → WeatherForecastDTO.weatherCode / weatherDescription
 * </pre>
 *
 * <p><b>Caching:</b> raw Open-Meteo JSON is cached in {@link WeatherCacheService}
 * (Caffeine, TTL 10 min). A scheduled task proactively refreshes the cache
 * every 10 minutes so users never hit a cold cache miss.
 *
 * <p><b>LLM access:</b> handled through Spring AI's {@link ChatClient} (see
 * {@code AiConfig}), instead of a hand-rolled HTTP call. The concrete model
 * provider (Ollama, OpenAI, etc.) is whatever Spring AI starter is on the
 * classpath and configured in {@code application.yml} — this class no
 * longer knows or cares which one.
 *
 * <p><b>Streaming:</b> {@link #chatStream} returns a reactive
 * {@code Flux<ServerSentEvent<String>>}. Three event types are emitted, in
 * order: one {@code "weather"} event (current + forecast, sent immediately,
 * before the LLM is even called), then zero or more {@code "token"} events
 * (one per chunk of the streamed LLM reply), then exactly one terminal event
 * — either {@code "done"} (full reply + updated history as JSON) or
 * {@code "error"} (failure message as JSON) if the model call failed.
 *
 * <p><b>Required {@code application.yml} (Ollama example):</b>
 * <pre>
 * spring:
 *   ai:
 *     ollama:
 *       base-url: http://localhost:11434
 *       chat:
 *         options:
 *           model: llama3
 * </pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherChatbotServiceImpl implements WeatherChatbotService {

    // ── Manhattan fixed coordinates ────────────────────────────────

    private static final double MANHATTAN_LAT   = 40.7831;
    private static final double MANHATTAN_LON   = -73.9712;
    private static final String LOCATION_LABEL  = "Manhattan, New York City";

    // ── WMO weather code → description ────────────────────────────

    private static final Map<Integer, String> WMO = Map.ofEntries(
            Map.entry(0, "Clear sky"),
            Map.entry(1, "Mainly clear"),
            Map.entry(2, "Partly cloudy"),
            Map.entry(3, "Overcast"),
            Map.entry(45, "Fog"),
            Map.entry(48, "Depositing rime fog"),
            Map.entry(51, "Light drizzle"),
            Map.entry(53, "Moderate drizzle"),
            Map.entry(55, "Dense drizzle"),
            Map.entry(56, "Light freezing drizzle"),
            Map.entry(57, "Dense freezing drizzle"),
            Map.entry(61, "Slight rain"),
            Map.entry(63, "Moderate rain"),
            Map.entry(65, "Heavy rain"),
            Map.entry(66, "Light freezing rain"),
            Map.entry(67, "Heavy freezing rain"),
            Map.entry(71, "Slight snow fall"),
            Map.entry(73, "Moderate snow fall"),
            Map.entry(75, "Heavy snow fall"),
            Map.entry(77, "Snow grains"),
            Map.entry(80, "Slight rain showers"),
            Map.entry(81, "Moderate rain showers"),
            Map.entry(82, "Violent rain showers"),
            Map.entry(85, "Slight snow showers"),
            Map.entry(86, "Heavy snow showers"),
            Map.entry(95, "Thunderstorm"),
            Map.entry(96, "Thunderstorm with slight hail"),
            Map.entry(99, "Thunderstorm with heavy hail")
    );

    private static final DateTimeFormatter ISO_DT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

    // ── Dependencies ────────────────────────────────────────────────

    /** Handles @Cacheable — must be a separate Spring bean, not a private method. */
    private final WeatherCacheService weatherCacheService;

    /** Spring AI entry point — provider-agnostic (Ollama, OpenAI, etc. via application.yml). */
    private final ChatClient chatClient;

    /** Used to JSON-encode SSE event payloads (weather snapshot, tokens, final response). */
    private final ObjectMapper objectMapper;

    // ── Public API ─────────────────────────────────────────────────

    @Override
    public ChatResponse chat(Long userId, ChatRequest request) {
        log.debug("Weather chat turn (blocking) — userId={}", userId);

        // 1. One cached call → current + daily forecast
        JsonNode weatherJson     = weatherCacheService.getRawWeather();
        CurrentWeatherDTO current   = parseCurrentWeather(weatherJson.path("current"));
        List<WeatherForecastDTO> forecast = parseDailyForecast(weatherJson.path("daily"));

        // 2. Build system prompt with all live data
        String systemPrompt = buildSystemPrompt(current, forecast);

        // 3. Append new user turn to history
        List<ChatMessage> updatedHistory = new ArrayList<>(request.getHistory());
        updatedHistory.add(new ChatMessage("user", request.getMessage()));

        // 4. Call LLM via Spring AI (blocking)
        String assistantReply = callChatModel(systemPrompt, updatedHistory);

        // 5. Append assistant reply for client to echo back next turn
        updatedHistory.add(new ChatMessage("assistant", assistantReply));

        return new ChatResponse(assistantReply, updatedHistory, current, forecast, LOCATION_LABEL);
    }

    @Override
    public Flux<ServerSentEvent<String>> chatStream(Long userId, ChatRequest request) {
        log.debug("Weather chat stream turn — userId={}", userId);

        // 1. One cached call → current + daily forecast (sent to the client immediately)
        JsonNode weatherJson     = weatherCacheService.getRawWeather();
        CurrentWeatherDTO current   = parseCurrentWeather(weatherJson.path("current"));
        List<WeatherForecastDTO> forecast = parseDailyForecast(weatherJson.path("daily"));

        // 2. Build system prompt with all live data
        String systemPrompt = buildSystemPrompt(current, forecast);

        // 3. Append new user turn to history
        List<ChatMessage> updatedHistory = new ArrayList<>(request.getHistory());
        updatedHistory.add(new ChatMessage("user", request.getMessage()));

        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(systemPrompt));
        for (ChatMessage msg : updatedHistory) {
            if ("user".equals(msg.getRole())) {
                messages.add(new UserMessage(msg.getContent()));
            } else {
                messages.add(new AssistantMessage(msg.getContent()));
            }
        }

        // Emitted first so the frontend can repaint the Overview panel
        // before the first LLM token even arrives.
        Flux<ServerSentEvent<String>> weatherFlux =
                Flux.just(buildWeatherEvent(current, forecast));

        // Accumulates the streamed chunks so the full reply can be persisted
        // in the history once the stream completes.
        StringBuilder replyBuilder = new StringBuilder();

        Flux<ServerSentEvent<String>> tokenFlux = chatClient.prompt(new Prompt(messages))
                .stream()
                .content()
                .filter(chunk -> chunk != null && !chunk.isEmpty())
                .doOnNext(replyBuilder::append)
                .map(this::buildTokenEvent);

        // Runs only after every token has been emitted — builds the
        // terminal "done" (or "error") event from the accumulated reply.
        Flux<ServerSentEvent<String>> terminalFlux = Flux.defer(() -> {
            String reply = replyBuilder.toString();
            if (reply.isBlank()) {
                log.error("Chat stream produced an empty reply");
                return Flux.just(buildErrorEvent("LLM returned an empty response"));
            }

            List<ChatMessage> finalHistory = new ArrayList<>(updatedHistory);
            finalHistory.add(new ChatMessage("assistant", reply));

            ChatResponse response =
                    new ChatResponse(reply, finalHistory, current, forecast, LOCATION_LABEL);
            return Flux.just(buildDoneEvent(response));
        });

        return Flux.concat(weatherFlux, tokenFlux, terminalFlux)
                .onErrorResume(e -> {
                    log.error("Chat stream failed: {}", e.getMessage(), e);
                    return Flux.just(buildErrorEvent(
                            "Could not reach the LLM service: " + e.getMessage()));
                });
    }

    @Override
    public ChatResponse fetchWeather() {
        JsonNode weatherJson     = weatherCacheService.getRawWeather();
        CurrentWeatherDTO current   = parseCurrentWeather(weatherJson.path("current"));
        List<WeatherForecastDTO> forecast = parseDailyForecast(weatherJson.path("daily"));
        // No LLM call — return weather data only (reply and history are null/empty)
        return new ChatResponse(null, List.of(), current, forecast, LOCATION_LABEL);
    }

    // ── Private helpers ────────────────────────────────────────────

    /**
     * Parses the {@code current} block.
     * This is real-time data updated every ~15 minutes by Open-Meteo.
     */
    private CurrentWeatherDTO parseCurrentWeather(JsonNode current) {
        CurrentWeatherDTO dto = new CurrentWeatherDTO();

        // "time" format from Open-Meteo: "2026-06-18T14:30"
        String timeStr = current.path("time").asText("");
        if (!timeStr.isBlank()) {
            dto.setTime(LocalDateTime.parse(timeStr, ISO_DT));
        }

        dto.setTemperature(current.path("temperature_2m").asDouble());
        dto.setApparentTemperature(current.path("apparent_temperature").asDouble());
        dto.setWindSpeed(current.path("wind_speed_10m").asDouble());
        dto.setRelativeHumidity(current.path("relative_humidity_2m").asInt());

        int code = current.path("weather_code").asInt();
        dto.setWeatherCode(code);
        dto.setWeatherDescription(WMO.getOrDefault(code, "Unknown"));

        return dto;
    }

    /**
     * Parses the {@code daily} block: index 0 = today, index 1 = tomorrow.
     */
    private List<WeatherForecastDTO> parseDailyForecast(JsonNode daily) {
        String[] labels = {"Today", "Tomorrow"};
        List<WeatherForecastDTO> result = new ArrayList<>();

        for (int i = 0; i < 2; i++) {
            WeatherForecastDTO dto = new WeatherForecastDTO();
            dto.setDate(LocalDate.parse(daily.path("time").get(i).asText()));
            dto.setLabel(labels[i]);

            int code = daily.path("weather_code").get(i).asInt();
            dto.setWeatherCode(code);
            dto.setWeatherDescription(WMO.getOrDefault(code, "Unknown"));

            dto.setTempMax(daily.path("temperature_2m_max").get(i).asDouble());
            dto.setTempMin(daily.path("temperature_2m_min").get(i).asDouble());
            dto.setApparentTempMax(daily.path("apparent_temperature_max").get(i).asDouble());
            dto.setApparentTempMin(daily.path("apparent_temperature_min").get(i).asDouble());
            dto.setPrecipitationSum(daily.path("precipitation_sum").get(i).asDouble());
            dto.setPrecipitationProbabilityMax(
                    daily.path("precipitation_probability_max").get(i).asInt());
            dto.setWindSpeedMax(daily.path("wind_speed_10m_max").get(i).asDouble());
            dto.setUvIndexMax(daily.path("uv_index_max").get(i).asDouble());

            result.add(dto);
        }

        return result;
    }

    /**
     * System prompt with all live data injected.
     *
     * <p>The LLM receives both real-time current conditions (for the "right now"
     * question) and the daily forecast (for planning / tomorrow questions).
     */
    private String buildSystemPrompt(CurrentWeatherDTO current,
                                     List<WeatherForecastDTO> forecast) {
        StringBuilder sb = new StringBuilder();

        sb.append("You are a knowledgeable and friendly weather assistant ")
                .append("specialized in Manhattan, New York City.\n")
                .append("Always reply in the same language the user writes in ")
                .append("(English).\n")
                .append("Keep answers practical and specific to Manhattan life ")
//                .append("(subway commutes, avenue wind tunnels, Central Park walks, etc.).\n\n")
        ;

        // ── Current conditions ──────────────────────────────────────
        sb.append("== CURRENT CONDITIONS (right now) ==\n")
                .append("  Temperature  : ").append(String.format("%.0f", current.getTemperature())).append("°F\n")
                .append("  Feels like   : ").append(String.format("%.0f", current.getApparentTemperature())).append("°F\n")
                .append("  Condition    : ").append(current.getWeatherDescription()).append("\n")
                .append("  Wind         : ").append(String.format("%.0f", current.getWindSpeed())).append(" mph\n")
                .append("  Humidity     : ").append(current.getRelativeHumidity()).append("%\n\n");

        // ── Daily forecast ──────────────────────────────────────────
        sb.append("== DAILY FORECAST ==\n");
        for (WeatherForecastDTO day : forecast) {
            sb.append(day.getLabel().toUpperCase())
                    .append(" (").append(day.getDate()).append("):\n")
                    .append("  Condition    : ").append(day.getWeatherDescription()).append("\n")
                    .append("  High / Low   : ").append(String.format("%.0f", day.getTempMax()))
                    .append("°F / ").append(String.format("%.0f", day.getTempMin())).append("°F\n")
                    .append("  Feels like   : ").append(String.format("%.0f", day.getApparentTempMax()))
                    .append("°F / ").append(String.format("%.0f", day.getApparentTempMin())).append("°F\n")
                    .append("  Rain chance  : ").append(day.getPrecipitationProbabilityMax()).append("%\n")
                    .append("  Precip       : ").append(String.format("%.2f", day.getPrecipitationSum())).append(" in\n")
                    .append("  Wind max     : ").append(String.format("%.0f", day.getWindSpeedMax())).append(" mph\n")
                    .append("  UV Index     : ").append(String.format("%.1f", day.getUvIndexMax())).append("\n\n");
        }

        sb.append("== YOUR TASKS ==\n")
                .append("Answer the user's question using only the data above. ")
                .append("For clothing questions, give specific item recommendations ")
                .append("(fabric, layers, footwear, accessories) suited to Manhattan — ")
//                .append("account for the avenue wind tunnels, -to-street temperature shift, ")
//                .append("and subway commutes.\n")
                .append("Use °F and mph. Do NOT fabricate any weather values.");

        return sb.toString();
    }

    /**
     * Calls the LLM via Spring AI's {@link ChatClient} (non-streaming).
     * Used by the blocking {@link #chat} method only — {@link #chatStream}
     * uses {@code .stream()} instead, further down in this class.
     */
    private String callChatModel(String systemPrompt, List<ChatMessage> history) {
        try {
            List<Message> messages = new ArrayList<>();
            messages.add(new SystemMessage(systemPrompt));
            for (ChatMessage msg : history) {
                if ("user".equals(msg.getRole())) {
                    messages.add(new UserMessage(msg.getContent()));
                } else {
                    messages.add(new AssistantMessage(msg.getContent()));
                }
            }

            log.debug("Calling chat model via Spring AI ChatClient (blocking)");

            String reply = chatClient.prompt(new Prompt(messages))
                    .call()
                    .content();

            if (reply == null || reply.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY, "LLM returned an empty response");
            }

            return reply;

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Chat model call failed: {}", e.getMessage(), e);
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not reach the LLM service: " + e.getMessage());
        }
    }

    /**
     * Builds the {@code "weather"} event — sent once, immediately, before
     * any LLM token, so the frontend can refresh the Overview panel without
     * waiting for the model.
     */
    private ServerSentEvent<String> buildWeatherEvent(CurrentWeatherDTO current,
                                                      List<WeatherForecastDTO> forecast) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("current", current);
        payload.put("forecast", forecast);
        payload.put("resolvedLocation", LOCATION_LABEL);
        return ServerSentEvent.<String>builder()
                .event("weather")
                .data(toJson(payload))
                .build();
    }

    /**
     * Builds one {@code "token"} event for a single streamed chunk of the
     * LLM reply. The chunk is JSON-string-encoded (rather than sent raw) so
     * that embedded newlines/quotes survive the single-line SSE {@code data:}
     * field intact — the client should {@code JSON.parse} the data payload.
     */
    private ServerSentEvent<String> buildTokenEvent(String chunk) {
        return ServerSentEvent.<String>builder()
                .event("token")
                .data(toJson(chunk))
                .build();
    }

    /**
     * Builds the terminal {@code "done"} event once the full reply has been
     * accumulated — carries the same {@link ChatResponse} shape the old
     * non-streaming endpoint returned, so the client's history-handling
     * logic barely needs to change.
     */
    private ServerSentEvent<String> buildDoneEvent(ChatResponse response) {
        return ServerSentEvent.<String>builder()
                .event("done")
                .data(toJson(response))
                .build();
    }

    /** Builds the terminal {@code "error"} event for a failed model call. */
    private ServerSentEvent<String> buildErrorEvent(String message) {
        return ServerSentEvent.<String>builder()
                .event("error")
                .data(toJson(Map.of("message", message)))
                .build();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.error("Failed to serialize SSE payload: {}", e.getMessage(), e);
            // Falls back to a minimal valid JSON string so the stream never breaks.
            return "{\"error\":\"serialization failed\"}";
        }
    }

}
