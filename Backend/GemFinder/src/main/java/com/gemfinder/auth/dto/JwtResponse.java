package com.gemfinder.auth.dto;

import com.gemfinder.admin.dto.UserDTO;
import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Response body after a successful login: contains the JWT and user info.
 */
@Data
@AllArgsConstructor
public class JwtResponse {

    /** token, to be sent in the Authorization header on subsequent requests */
    private String token;

    /** Basic user info (excluding the password) */
    private UserDTO user;
}
