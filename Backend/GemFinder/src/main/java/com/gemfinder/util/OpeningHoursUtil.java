package com.gemfinder.util;

import ch.poole.openinghoursparser.OpeningHoursParser;
import ch.poole.openinghoursparser.Rule;
import io.leonard.OpeningHoursEvaluator;
import io.leonard.OpeningHoursEvaluator;
import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayInputStream;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
public class OpeningHoursUtil {

    private OpeningHoursUtil() {}

    /**
     * Evaluates whether an attraction is open at the given time using
     * the opening-hours-evaluator library (OSM format).
     * Returns null if the string cannot be parsed.
     */
    public static Boolean isOpen(String openingHours, LocalDateTime time) {
        if (openingHours == null || openingHours.isBlank()) return null;
        try {
            OpeningHoursParser parser = new OpeningHoursParser(
                    new ByteArrayInputStream(openingHours.getBytes()));
            List<Rule> rules = parser.rules(false); // false = non-strict mode
            return io.leonard.OpeningHoursEvaluator.isOpenAt(time, rules);
        } catch (Exception e) {
            log.debug("Could not parse opening hours '{}': {}", openingHours, e.getMessage());
            return null;
        }
    }
}
