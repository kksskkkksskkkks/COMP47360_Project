package com.gemfinder.util;

import com.gemfinder.admin.entity.User;
import com.gemfinder.admin.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * JWT authentication filter: runs once per request.
 * Parses the JWT from the "Authorization: Bearer <token>" header,
 * and checks whether the tokenVersion in the token matches the current
 * value in the database:
 *   - match      -> set the SecurityContext, request proceeds
 *   - mismatch   (password changed / account banned / forced logout)
 *                -> treat as an invalid token, no authentication set
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                Claims claims = jwtUtil.parseToken(token);

                Long userId = Long.parseLong(claims.getSubject());
                Integer tokenVersion = jwtUtil.getTokenVersion(claims);

                Optional<User> userOpt = userRepository.findById(userId);

                if (userOpt.isPresent()
                        && userOpt.get().getIsActive()
                        && userOpt.get().getTokenVersion().equals(tokenVersion)) {

                    User user = userOpt.get();
                    // Use the role from the freshly-queried User entity, not the JWT claim.
                    // The claim reflects the role at issuance time; if the role was changed
                    // since then (e.g. demoted by a SUPERADMIN), this keeps authorization
                    // based on the current database state rather than a stale token value.
                    String role = user.getRole().name();
                    var authority = new SimpleGrantedAuthority("ROLE_" + role);

                    var authentication = new UsernamePasswordAuthenticationToken(
                            String.valueOf(user.getId()),   // principal = userId (String)
                            null,
                            List.of(authority)
                    );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    request.setAttribute("userId", user.getId());
                    request.setAttribute("role", role);   // exposes caller's role for target-based checks (e.g. ADMIN vs SUPERADMIN)

                } else {
                    log.debug("Token rejected: stale tokenVersion or inactive/missing user, userId={}", userId);
                }

            } catch (JwtException | IllegalArgumentException e) {
                log.debug("Invalid JWT token: {}", e.getMessage());
                // No Authentication is set; Spring Security will reject protected routes downstream
            }
        }

        filterChain.doFilter(request, response);
    }
}
