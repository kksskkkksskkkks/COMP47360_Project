package com.gemfinder.weather_chatbot.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response body for {@code POST /api/weather-chatbot/chat} and
 * {@code GET /api/weather-chatbot/forecast}.
 *
 * <p>The client stores {@code updatedHistory} and echoes it back on the
 * next request, preserving multi-turn context without server-side sessions.
 *
 * <p>Frontend data mapping:
 * <pre>
 *   Left panel — "TODAY" card
 *     current.temperature          → big "72°" number
 *     current.weatherDescription   → "Mostly Clear"
 *     forecast[0].tempMax/tempMin  → "High / Low  75° / 58°"
 *     forecast[0].precipitationProbabilityMax → "Precipitation 10%"
 *
 *
 *   Left panel — "TOMORROW" card
 *     forecast[1].tempMax          → "65°"
 *     forecast[1].weatherDescription → "Showers Expected"
 *     forecast[1].precipitationProbabilityMax → "80% Rain"
 *
 *   Right panel — chat
 *     reply, updatedHistory        → conversation bubbles
 * </pre>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatResponse {

    /** The assistant's reply text for this conversation turn. */
    private String reply;

    /**
     * Full conversation history including the just-completed turn.
     * The client must store this and send it back on the next request.
     */
    private List<ChatMessage> updatedHistory;

    /**
     * Real-time current conditions for Manhattan.
     * Maps to the large temperature + condition display in the "TODAY" card.
     */
    private CurrentWeatherDTO current;

    /**
     * Daily forecast: index 0 = today, index 1 = tomorrow.
     * Each entry carries high/low temps, precipitation probability,
     * feels-like temps, wind, UV, and weather description.
     */
    private List<WeatherForecastDTO> forecast;

    /** Always "Manhattan, New York City". */
    private String resolvedLocation;
}
