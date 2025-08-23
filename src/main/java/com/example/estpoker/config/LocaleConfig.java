package com.example.estpoker.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull; // import the Spring NonNull annotation
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.i18n.LocaleChangeInterceptor;
import org.springframework.web.servlet.i18n.SessionLocaleResolver;

import java.util.Locale;

/**
 * Locale/i18n configuration.
 *
 * - Stores the user's Locale in the HTTP session (SessionLocaleResolver).
 * - Allows switching the language using the query parameter "lang"
 *   (e.g., /room?lang=de or via our /i18n?lang=de controller that 303-redirects back).
 *
 * Thymeleaf will render messages for the active Locale, and the
 * <html th:lang="${#locale}"> attribute will reflect it.
 */
@Configuration
public class LocaleConfig implements WebMvcConfigurer {

    /** Keep the selected locale in the session; default to English. */
    @Bean
    public LocaleResolver localeResolver() {
        SessionLocaleResolver r = new SessionLocaleResolver();
        r.setDefaultLocale(Locale.ENGLISH);
        return r;
    }

    /**
     * Interceptor that checks the request for "?lang=..." and updates the session locale.
     * We keep the parameter name "lang" to align with menu.js and LocaleController.
     */
    @Bean
    public LocaleChangeInterceptor localeChangeInterceptor() {
        LocaleChangeInterceptor i = new LocaleChangeInterceptor();
        i.setParamName("lang"); // supports ?lang=de | ?lang=en
        return i;
    }

    /** Register the interceptor so it runs on every request. */
    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(localeChangeInterceptor());
    }
}
