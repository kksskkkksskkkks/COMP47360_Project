package com.gemfinder.weather_chatbot.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Builds the {@link ChatClient} bean used by {@code WeatherChatbotServiceImpl}.
 *
 * <p>Spring AI auto-configures a {@code ChatClient.Builder} bean for you based on
 * whichever model starter is on the classpath (here: Ollama — see the
 * {@code spring-ai-starter-model-ollama} dependency). We just need to turn that
 * builder into a concrete {@link ChatClient} bean once.
 *
 * <p>Connection / model settings (base URL, model name, etc.) are no longer
 * read via {@code @Value} in the service — they live in
 * {@code application.yml} under the {@code spring.ai.ollama.*} prefix, e.g.:
 * <pre>
 * spring:
 *   ai:
 *     ollama:
 *       base-url: http://localhost:11434
 *       chat:
 *         options:
 *           model: llama3
 * </pre>
 */
@Slf4j
@Configuration
public class AiConfig {

    @Bean
    public ChatClient chatClient(ChatClient.Builder chatClientBuilder) {
        return chatClientBuilder.build();
    }


}
