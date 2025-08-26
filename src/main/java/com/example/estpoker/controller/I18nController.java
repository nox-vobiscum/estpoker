package com.example.estpoker.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** Exports i18n message catalogs as JSON for dynamic in-page language switching. */
@RestController
@RequestMapping("/i18n")
public class I18nController {

    @GetMapping(value = "/messages", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, String> messages(@RequestParam(name = "lang", required = false) String lang) {
        // Fallback to 'en' if missing/unknown
        Locale locale = toLocaleOrDefault(lang, Locale.ENGLISH);

        // Load ResourceBundle with standard fallback chain (e.g., messages_de -> messages)
        ResourceBundle bundle = ResourceBundle.getBundle("messages", locale);

        // Flatten to a simple LinkedHashMap to keep iteration order stable
        Map<String, String> out = new LinkedHashMap<>();
        for (Enumeration<String> e = bundle.getKeys(); e.hasMoreElements(); ) {
            String key = e.nextElement();
            out.put(key, bundle.getString(key));
        }
        return out;
    }

    // --- helpers ------------------------------------------------------------------------------

    /** Accepts 'de', 'en', 'de-DE', etc.; falls back to defaultLocale if null/blank. */
    private static Locale toLocaleOrDefault(String code, Locale defaultLocale) {
        if (code == null || code.isBlank()) return defaultLocale;
        try {
            Locale byTag = Locale.forLanguageTag(code.trim());
            if (byTag.getLanguage() != null && !byTag.getLanguage().isBlank()) return byTag;
        } catch (Exception ignored) { /* fall through */ }
        return defaultLocale;
    }
}
