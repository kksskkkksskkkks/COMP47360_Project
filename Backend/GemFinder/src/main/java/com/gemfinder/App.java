package com.gemfinder;

//import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * main starter
 *
 */

@SpringBootApplication
@EnableJpaAuditing
//@EnableScheduling
public class App
{
    public static void main( String[] args )
    {
        SpringApplication.run(App.class, args);
    }
}
