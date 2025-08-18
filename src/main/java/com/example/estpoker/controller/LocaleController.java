package com.example.estpoker.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.LocaleResolver;

@Controller
public class LocaleController {

    private final LocaleResolver localeResolver;

    public LocaleController(LocaleResolver localeResolver) {
        this.localeResolver = localeResolver;
    }

    @PostMapping(path = "/i18n", consumes = "application/x-www-form-urlencoded")
    public ResponseEntity<Void> setLanguagePost(@RequestParam("lang") String lang,
                                                HttpServletRequest request,
                                                HttpServletResponse response) {
        setLocale(lang, request, response);
        String back = backUrl(request);
        // 303 -> Browser navigiert zurück zur Seite (URL bleibt clean)
        return ResponseEntity.status(303).header("Location", back).build();
    }

    @GetMapping("/i18n")
    public ResponseEntity<Void> setLanguageGet(@RequestParam("lang") String lang,
                                               HttpServletRequest request,
                                               HttpServletResponse response) {
        setLocale(lang, request, response);
        String back = backUrl(request);
        return ResponseEntity.status(303).header("Location", back).build();
    }

    private void setLocale(String lang, HttpServletRequest req, HttpServletResponse resp) {
        Locale target = (lang != null && lang.toLowerCase().startsWith("de")) ? Locale.GERMAN : Locale.ENGLISH;
        localeResolver.setLocale(req, resp, target);
    }

    // Nur auf dieselbe Origin zurückleiten; ansonsten auf Root.
    private String backUrl(HttpServletRequest req) {
        String ref = req.getHeader("Referer");
        if (ref == null || ref.isBlank()) return "/";
        try {
            URI refUri = new URI(ref);
            String host = Optional.ofNullable(req.getHeader("Host")).orElse("");
            // gleiche Origin?
            if (!host.isBlank() && host.equalsIgnoreCase(refUri.getHost() + (refUri.getPort() > 0 ? ":" + refUri.getPort() : ""))) {
                String path = Optional.ofNullable(refUri.getRawPath()).orElse("/");
                String q = refUri.getRawQuery();
                return (q == null || q.isBlank()) ? path : (path + "?" + q);
            }
        } catch (URISyntaxException ignored) {}
        return "/";
    }
}
