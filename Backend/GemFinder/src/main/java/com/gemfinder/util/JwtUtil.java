package com.gemfinder.util;

import com.gemfinder.enums.Role;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT utility class: responsible for generating, parsing, and validating JWTs.
 *
 * Config properties (application.properties / application.yml):
 */
@Component
public class JwtUtil {

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtUtil(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms:86400000}") long expirationMs) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    /**
     * Generate a JWT.
     * The subject is the user ID, with "role" and "tokenVersion" claims attached.
     * tokenVersion supports server-side invalidation of old tokens
     * (password change / account ban / force logout).
     */
    public String generateToken(Long userId, Role role, Integer tokenVersion) {
        Date now    = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("role", role.name())
                .claim("tokenVersion", tokenVersion)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(secretKey)
                .compact();
    }

    /** Parse and validate the token, returning Claims; throws JwtException on failure */
    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /** Extract the user ID from a valid token */
    public Long getUserId(String token) {
        return Long.parseLong(parseToken(token).getSubject());
    }

    /** Extract the role from a valid token */
    public Role getRole(String token) {
        return Role.valueOf(parseToken(token).get("role", String.class));
    }

    /** Extract the tokenVersion from valid Claims */
    public Integer getTokenVersion(Claims claims) {
        return claims.get("tokenVersion", Integer.class);
    }

    /** Quick check of whether a token is valid (no exception thrown; checks signature and expiry only, not tokenVersion) */
    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
