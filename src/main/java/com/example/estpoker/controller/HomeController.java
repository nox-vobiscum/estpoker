package com.example.estpoker.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    // Eigene, konfliktfreie Landingpage (optional)
    // Die Startseite "/" liegt im GameController.landingPage()
    @GetMapping("/home")
    public String home() {
        return "index";
    }

    // About page with SEO-optimized content
    @GetMapping("/about")
    public String about() {
        return "about";
    }
}
