package com.gemfinder.busyness_forecast.mapper;

import com.gemfinder.busyness_forecast.dto.BusynessForecastDTO;
import com.gemfinder.busyness_forecast.entity.BusynessForecast;

public class BusynessForecastMapper {

    private BusynessForecastMapper() {}

    public static BusynessForecastDTO toDTO(BusynessForecast e) {
        BusynessForecastDTO dto = new BusynessForecastDTO();
        dto.setZoneId(e.getId().getZoneId());
        dto.setTimeBucket(e.getId().getTimeBucket());
        dto.setPredictedDropoffs(e.getPredictedDropoffs());
        dto.setBusynessLevel(e.getBusynessLevel());
        dto.setBusynessLevelRelative(e.getBusynessLevelRelative());
        dto.setTemperature2m(e.getTemperature2m());
        dto.setPrecipitation(e.getPrecipitation());
        dto.setWeathercode(e.getWeathercode());
        dto.setWindspeed10m(e.getWindspeed10m());
        dto.setUpdatedAt(e.getUpdatedAt());
        return dto;
    }
}
