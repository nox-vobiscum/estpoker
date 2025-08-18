package com.example.estpoker.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(FeaturesProperties.class)
public class FeaturesConfig { }
