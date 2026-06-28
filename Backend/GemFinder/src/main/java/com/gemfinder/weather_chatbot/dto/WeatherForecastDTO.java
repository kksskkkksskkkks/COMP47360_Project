package com.gemfinder.weather_chatbot.dto;

import lombok.Data;

import java.time.LocalDate;

/**
 * One day's weather summary for Manhattan, New York City.
 *
 * <p>Units match NYC convention:
 * <ul>
 *   <li>Temperature / apparent temperature — °F</li>
 *   <li>Precipitation                      — inches</li>
 *   <li>Wind speed                         — mph</li>
 * </ul>
 */
@Data
public class WeatherForecastDTO {

    private LocalDate date;

    /** "Today" or "Tomorrow" */
    private String label;

    // ── Temperature ────────────────────────────────────────────────

    /** Actual high temperature (°F) */
    private Double tempMax;

    /** Actual low temperature (°F) */
    private Double tempMin;

    /**
     * "Feels like" high (°F).
     * Accounts for Manhattan's wind-chill in winter and heat index in summer.
     */
    private Double apparentTempMax;

    /** "Feels like" low (°F) */
    private Double apparentTempMin;

    // ── Precipitation ──────────────────────────────────────────────

    /** Total precipitation in inches */
    private Double precipitationSum;

    /** Maximum precipitation probability for the day (0–100 %) */
    private Integer precipitationProbabilityMax;

    // ── Wind & UV ──────────────────────────────────────────────────

    /** Max wind speed in mph */
    private Double windSpeedMax;

    private Double uvIndexMax;

    // ── Condition ─────────────────────────────────────────────────

    /** WMO weather interpretation code */
    private Integer weatherCode;

    /** Human-readable description derived from {@code weatherCode} */
    private String weatherDescription;
}
