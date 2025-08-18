package com.example.estpoker.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.LocaleResolver;

import java.util.Locale;

@Controller
public class LocaleController {

    private final LocaleResolver localeResolver;

    public LocaleController(LocaleResolver localeResolver) {
        this.localeResolver = localeResolver;
    }

    @PostMapping(path = "/i18n", consumes = "application/x-www-form-urlencoded")
    public ResponseEntity<Void> setLanguage(@RequestParam("lang") String lang,
                                            HttpServletRequest request,
                                            HttpServletResponse response) {
        Locale target = (lang != null && lang.toLowerCase().startsWith("de"))
                ? Locale.GERMAN
                : Locale.ENGLISH;

        localeResolver.setLocale(request, response, target);
        // 204 -> client reloads the current page (URL unchanged)
        return ResponseEntity.noContent().build();
    }
}
