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

/**
 * Explicit locale switch endpoint.
 *
 * We keep it primarily for a clean UX:
 * - Frontend navigates to /i18n?lang=de (GET).
 * - We set the session locale and 303-redirect back to the referrer
 *   so the page is re-rendered with the new language and the URL stays clean.
 *
 * NOTE: The LocaleChangeInterceptor (param "lang") is also active,
 * so a simple navigation with ?lang=de works as well.
 */
@Controller
public class LocaleController {

    private final LocaleResolver localeResolver;

    public LocaleController(LocaleResolver localeResolver) {
        this.localeResolver = localeResolver;
    }

    /** Accept GET to avoid CSRF issues and leverage a 303 back redirect. */
    @GetMapping("/i18n")
    public ResponseEntity<Void> setLanguageGet(@RequestParam("lang") String lang,
                                               HttpServletRequest request,
                                               HttpServletResponse response) {
        setLocale(lang, request, response);
        String back = backUrl(request);
        // 303 -> browser navigates back to the previous page (clean URL, no /i18n in history)
        return ResponseEntity.status(303).header("Location", back).build();
    }

    /** Keep POST as a compatible fallback (not used by our frontend anymore). */
    @PostMapping(path = "/i18n", consumes = "application/x-www-form-urlencoded")
    public ResponseEntity<Void> setLanguagePost(@RequestParam("lang") String lang,
                                                HttpServletRequest request,
                                                HttpServletResponse response) {
        setLocale(lang, request, response);
        String back = backUrl(request);
        return ResponseEntity.status(303).header("Location", back).build();
    }

    /** Map "de" (or "de-AT/de-DE/…") to Locale.GERMAN, otherwise default to ENGLISH. */
    private void setLocale(String lang, HttpServletRequest req, HttpServletResponse resp) {
        Locale target = (lang != null && lang.toLowerCase().startsWith("de"))
                ? Locale.GERMAN : Locale.ENGLISH;
        localeResolver.setLocale(req, resp, target);
    }

    /**
     * Safe redirect: only redirect back to same-origin referrer.
     * If referrer is missing or cross-origin, go to "/".
     */
    private String backUrl(HttpServletRequest req) {
        String ref = req.getHeader("Referer");
        if (ref == null || ref.isBlank()) return "/";
        try {
            URI refUri = new URI(ref);
            String host = Optional.ofNullable(req.getHeader("Host")).orElse("");
            // Build "<host>[:port]" from referrer to compare with current request host header
            String refHostPort = refUri.getHost() + (refUri.getPort() > 0 ? ":" + refUri.getPort() : "");
            // Same origin?
            if (!host.isBlank() && host.equalsIgnoreCase(refHostPort)) {
                String path = Optional.ofNullable(refUri.getRawPath()).orElse("/");
                String q = refUri.getRawQuery();
                return (q == null || q.isBlank()) ? path : (path + "?" + q);
            }
        } catch (URISyntaxException ignored) {}
        return "/";
    }
}
