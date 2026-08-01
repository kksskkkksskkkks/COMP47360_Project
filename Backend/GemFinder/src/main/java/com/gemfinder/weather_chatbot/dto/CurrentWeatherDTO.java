package com.gemfinder.weather_chatbot.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Real-time (current hour) weather observation for Manhattan.
 * Updated every ~15 minutes by Open-Meteo.
 * Units: °F, mph.
 */
@Data
public class CurrentWeatherDTO {

    /** Observation timestamp (America/New_York) */
    private LocalDateTime time;

    /** Current real-time temperature (°F) */
    private Double temperature;

    /** Current "feels like" temperature (°F) — accounts for Manhattan avenue wind-tunnel effect */
    private Double apparentTemperature;

    /** WMO weather code */
    private Integer weatherCode;

    /** Weather description, e.g. "Partly cloudy" */
    private String weatherDescription;

    /** Current wind speed (mph) */
    private Double windSpeed;

    /** Current relative humidity (%) */
    private Integer relativeHumidity;
}
