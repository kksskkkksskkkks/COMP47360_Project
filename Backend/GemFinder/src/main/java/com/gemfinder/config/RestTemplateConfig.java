package com.gemfinder.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import org.springframework.beans.factory.annotation.Value;


//@Configuration
//public class RestTemplateConfig {
//
//    @Bean("flaskRestTemplate")
//    public RestTemplate flaskRestTemplate() {
//        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
//        factory.setConnectTimeout(5000);   // 5s
//        factory.setReadTimeout(10000);     // 10s
//        return new RestTemplate(factory);
//    }
//}


@Configuration
public class RestTemplateConfig {

    @Value("${external.flask.base-url}")
    private String flaskBaseUrl;

    @Bean("flaskRestTemplate")
    public RestTemplate flaskRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        RestTemplate restTemplate = new RestTemplate(factory);
        // Set baseUrl so that the relative path /predict in FlaskClient can be correctly concatenated.
        restTemplate.setUriTemplateHandler(
                new org.springframework.web.util.DefaultUriBuilderFactory(flaskBaseUrl)
        );
        return restTemplate;
    }
}