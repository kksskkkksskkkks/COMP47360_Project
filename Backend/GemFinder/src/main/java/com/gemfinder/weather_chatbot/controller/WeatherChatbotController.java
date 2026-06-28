package com.gemfinder.weather_chatbot.controller;

import com.gemfinder.util.ApiResponse;
import com.gemfinder.weather_chatbot.dto.ChatRequest;
import com.gemfinder.weather_chatbot.dto.ChatResponse;
import com.gemfinder.weather_chatbot.service.WeatherChatbotService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

/**
 * REST controller for the Manhattan weather chatbot.
 *
 * <p>Both endpoints require a valid JWT, consistent with every other
 * module in the project. {@code SecurityConfig}'s default rule
 * ({@code anyRequest().authenticated()}) already covers these paths —
 * no extra wiring was needed there. {@code userId} is read via
 * {@code @RequestAttribute}, injected by {@code JwtAuthFilter} on every
 * authenticated request (same pattern as {@code AuthController}).
 *
 * <pre>
 * POST /api/weather-chatbot/chat
 *     Header: Authorization: Bearer &lt;token&gt;
 *     Body  : { "message": "What should I wear today?", "history": [] }
 *     → ApiResponse&lt;ChatResponse&gt;   (reply + updatedHistory + current + forecast)
 *
 * POST /api/weather-chatbot/chat/stream   (Content-Type: text/event-stream)
 *     Header: Authorization: Bearer &lt;token&gt;
 *     Body  : { "message": "What should I wear today?", "history": [] }
 *     → Server-Sent Events, in order:
 *         event: weather   data: { current, forecast, resolvedLocation }
 *         event: token     data: "&lt;next reply chunk, JSON-string-encoded&gt;"   (repeated)
 *         event: done      data: { reply, updatedHistory, current, forecast, resolvedLocation }
 *       (or "event: error  data: { message }" instead of "done" on failure)
 *
 * GET  /api/weather-chatbot/forecast
 *     Header: Authorization: Bearer &lt;token&gt;
 *     → ApiResponse&lt;ChatResponse&gt;   (current + forecast only; reply = null)
 * </pre>
 */
@RestController
@RequestMapping("/api/weather-chatbot")
@RequiredArgsConstructor
public class WeatherChatbotController {

    private final WeatherChatbotService weatherChatbotService;

    /**
     * Main conversational endpoint (blocking) — waits for the full LLM
     * reply before responding. Requires login.
     *
     * <p>{@code userId} is currently used only for logging / future
     * per-user persistence (e.g. saving chat history to the database).
     * The weather data itself is shared across all users — see
     * {@code WeatherCacheService} — only the LLM conversation is
     * user-specific.
     */
    @PostMapping("/chat")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ChatResponse> chat(
            @Valid @RequestBody ChatRequest request,
            @RequestAttribute("userId") Long userId) {
        return ApiResponse.success(weatherChatbotService.chat(userId, request));
    }

    /**
     * Streaming counterpart of {@link #chat} — same input, but delivers the
     * reply as Server-Sent Events instead of waiting for the full response.
     * See the class-level Javadoc above for the exact event sequence.
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("isAuthenticated()")
    public Flux<ServerSentEvent<String>> chatStream(
            @Valid @RequestBody ChatRequest request,
            @RequestAttribute("userId") Long userId) {
        return weatherChatbotService.chatStream(userId, request);
    }

    /**
     * Standalone forecast endpoint — no LLM call, no history. Requires login.
     * Call this on page load to pre-populate the Overview panel
     * before the user sends their first message.
     *
     * <p>Returns the same {@link ChatResponse} shape as {@code /chat},
     * with {@code reply = null} and {@code updatedHistory = []}.
     */
    @GetMapping("/forecast")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ChatResponse> forecast() {
        return ApiResponse.success(weatherChatbotService.fetchWeather());
    }
}
