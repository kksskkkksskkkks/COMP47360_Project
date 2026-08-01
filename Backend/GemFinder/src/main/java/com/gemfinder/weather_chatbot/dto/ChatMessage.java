package com.gemfinder.weather_chatbot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single message turn used inside {@link ChatRequest#getHistory()}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    /** "user" or "assistant" */
    @NotBlank
    @Pattern(regexp = "user|assistant")
    private String role;

    @NotBlank
    @jakarta.validation.constraints.Size(max = 4000)
    private String content;
}
