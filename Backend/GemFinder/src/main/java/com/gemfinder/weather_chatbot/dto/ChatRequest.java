package com.gemfinder.weather_chatbot.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Request body for {@code POST /api/weather-chatbot/chat}.
 *
 * <p>This chatbot is fixed to Manhattan, New York City — no {@code city}
 * parameter is needed. The client maintains conversation state by
 * replaying the full {@code history} on every turn (stateless server design).
 */
@Data
public class ChatRequest {

    /**
     * The user's latest message.
     * Supports English
     */
    @NotBlank
    @Size(max = 1000)
    private String message;

    /**
     * Full prior turns in chronological order.
     * Each entry is {@code {"role": "user"|"assistant", "content": "…"}}.
     * Send an empty list for the very first message in a session.
     *
     * <p>{@code @Valid} here triggers cascading validation: without it,
     * Spring would validate this {@code ChatRequest} object itself but
     * would NOT descend into each {@link ChatMessage} inside the list, so
     * {@code ChatMessage}'s own {@code @NotBlank}/{@code @Pattern}/{@code @Size}
     * constraints would silently never run.
     *
     * <p>{@code @Size(max = ...)} caps how many prior turns a single request
     * can carry. Without this, each individual message is bounded (4000
     * chars via {@link ChatMessage#getContent()}), but the list itself has
     * no upper bound — a client could replay hundreds of valid-looking
     * messages every turn, ballooning the prompt sent to the LLM (slower
     * responses, higher resource/cost per call). 40 turns (~20 user +
     * ~20 assistant messages) comfortably covers a real conversation while
     * blocking abuse; tune to taste.
     */
    @Valid
    @Size(max = 30, message = "Conversation history is too long; please start a new chat")
    private List<ChatMessage> history = new ArrayList<>();
}