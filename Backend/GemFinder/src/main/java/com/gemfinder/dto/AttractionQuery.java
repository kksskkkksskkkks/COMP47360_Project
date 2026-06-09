//package com.gemfinder.dto;
//
//import lombok.Data;
//
//@Data
//public class AttractionQuery {
//
//    /** Filter by category, e.g. "museum", "park". */
//    private String  category;
//
//    /** When true, return only wheelchair-accessible attractions. */
//    private Integer wheelchair;
//
//    /** Page number, 1-based. Defaults to 1 if not supplied. */
//    private Integer page = 1;
//
//    /** Page size. Defaults to 20; max 100. */
//    private Integer size = 20;
//}


package com.gemfinder.dto;

import lombok.Data;

import java.util.List;

@Data
public class AttractionQuery {

    /**
     * Filter by one or more categories, e.g. ["Museum", "Park"].
     * Null or empty means no category filter is applied.
     * Spring MVC binds repeated query params automatically:
     *   ?categories=Museum&categories=Park → List["Museum", "Park"]
     */
    private List<String> categories;

    /**
     * Wheelchair accessibility filter.
     * 1 = return only accessible attractions (wheelchair >= 1, i.e. limited or full).
     * Null or 0 = no filter applied.
     */
    private Integer wheelchair;

    /** Page number, 1-based. Defaults to 1 if not supplied. */
    private Integer page = 1;

    /** Page size. Defaults to 20; max 100. */
    private Integer size = 20;
}