package com.gemfinder.mapper;


import com.gemfinder.dto.AttractionQuery;
import com.gemfinder.entity.Attraction;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

@Mapper
public interface AttractionMapper {

    /**
     * Returns a paginated list of attractions, filtered by the given query.
     * Offset and limit are derived from {@code query.page} and {@code query.size}
     * inside the XML using dynamic SQL.
     */
    List<Attraction> findAll(@Param("q") AttractionQuery query);

    /**
     * Returns the total count of attractions matching the same filters,
     * used to populate {@code PageResult.total}.
     */
    long countAll(@Param("q") AttractionQuery query);

    /** Returns a single attraction by primary key, or empty if not found. */
    Optional<Attraction> findById(@Param("id") Long id);

    /**
     * Returns all distinct category values present in the table.
     * Used by the frontend filter dropdown.
     */
    List<String> findAllCategories();
}