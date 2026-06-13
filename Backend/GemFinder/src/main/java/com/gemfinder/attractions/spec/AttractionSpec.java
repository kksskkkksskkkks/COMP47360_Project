package com.gemfinder.attractions.spec;

import com.gemfinder.attractions.entity.Attraction;
import org.springframework.data.jpa.domain.Specification;

public class AttractionSpec {

    private AttractionSpec() {}

    public static Specification<Attraction> hasCategory(String category) {
        return (root, query, cb) ->
                category == null ? null : cb.equal(root.get("category"), category);
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