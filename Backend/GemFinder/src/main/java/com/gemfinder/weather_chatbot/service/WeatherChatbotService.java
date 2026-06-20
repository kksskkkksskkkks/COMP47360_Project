package com.gemfinder.weather_chatbot.service;

import com.gemfinder.weather_chatbot.dto.ChatRequest;
import com.gemfinder.weather_chatbot.dto.ChatResponse;
import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;

/**
 * Weather chatbot service fixed to Manhattan, New York City.
 *
 * <p>{@link ChatResponse} carries both real-time current conditions
 * ({@code current}) and a two-day daily forecast ({@code forecast}),
 * giving the frontend everything it needs to render the full Overview panel:
 * <ul>
 *   <li>TODAY card   — current temp, condition, daily high/low, precipitation %</li>
 *   <li>ATTIRE card  — clothing advice extracted from the LLM reply</li>
 *   <li>TOMORROW card — tomorrow's high, condition, precipitation %</li>
 * </ul>
 */
public interface WeatherChatbotService {

    /**
     * Processes one conversational turn as a Server-Sent-Events stream.
     * <ol>
     *   <li>Fetches current + 2-day forecast for Manhattan from Open-Meteo</li>
     *   <li>Emits a single {@code "weather"} event right away so the frontend
     *       can refresh the Overview panel without waiting for the LLM</li>
     *   <li>Injects all weather data into a Manhattan-specific system prompt</li>
     *   <li>Streams the LLM reply token-by-token as {@code "token"} events</li>
     *   <li>Emits a final {@code "done"} event carrying the full reply and
     *       updated history (the client must store this for the next turn),
     *       or an {@code "error"} event if the model call failed</li>
     * </ol>
     *
     * @param userId  the authenticated caller's id (from JWT), used for
     *                logging and as the hook point for future per-user
     *                chat history persistence — not yet stored anywhere
     * @param request user message and prior conversation history
     */
    Flux<ServerSentEvent<String>> chatStream(Long userId, ChatRequest request);

    /**
     * Processes one conversational turn, blocking until the full reply is
     * available (the original, non-streaming behavior). Kept alongside
     * {@link #chatStream} for callers that don't need token-by-token
     * delivery (e.g. simple integrations, tests, non-browser clients).
     * <ol>
     *   <li>Fetches current + 2-day forecast for Manhattan from Open-Meteo</li>
     *   <li>Injects all weather data into a Manhattan-specific system prompt</li>
     *   <li>Sends the full message history to the configured LLM</li>
     *   <li>Returns the assistant reply, updated history, and all weather data</li>
     * </ol>
     *
     * @param userId  the authenticated caller's id (from JWT), used for
     *                logging and as the hook point for future per-user
     *                chat history persistence — not yet stored anywhere
     * @param request user message and prior conversation history
     */
    ChatResponse chat(Long userId, ChatRequest request);

    /**
     * Fetches current conditions + today/tomorrow forecast for Manhattan.
     * Exposed for the standalone {@code GET /api/weather-chatbot/forecast} endpoint,
     * so the frontend can pre-populate the Overview panel before the first message.
     */
    ChatResponse fetchWeather();
}
