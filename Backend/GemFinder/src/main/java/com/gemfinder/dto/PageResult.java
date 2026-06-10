package com.gemfinder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/**
 * Generic wrapper for paginated list responses.
 *
 * @param <T> the type of items in the page
 */
@Data
@AllArgsConstructor
public class PageResult<T> {

    private List<T> items;
    private long    total;   // total number of records matching the filter
    private int     page;    // current page number (1-based)
    private int     size;    // page size requested
}
