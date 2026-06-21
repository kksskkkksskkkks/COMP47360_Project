package com.gemfinder.attractions.spec;

import com.gemfinder.attractions.entity.Attraction;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;

public class AttractionSpec {

    private AttractionSpec() {}

    // String -> List<String>, exact "equal" match replaced with "IN"
    public static Specification<Attraction> hasCategory(List<String> categories) {
        return (root, query, cb) ->
                (categories == null || categories.isEmpty())
                        ? null
                        : root.get("category").in(categories);
    }

    public static Specification<Attraction> hasKeyword(String keyword) {
        return (root, query, cb) ->
                keyword == null ? null : cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%");
    }

    public static Specification<Attraction> hasWheelchairAtLeast(Integer minLevel) {
        return (root, query, cb) ->
                minLevel == null ? null : cb.greaterThanOrEqualTo(root.get("wheelchair"), minLevel);
    }
}