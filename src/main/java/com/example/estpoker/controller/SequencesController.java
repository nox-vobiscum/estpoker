package com.example.estpoker.controller;

import com.example.estpoker.model.CardSequences;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
public class SequencesController {

  @GetMapping("/sequences")
  public Map<String, Object> sequences() {
    Map<String, List<String>> seqs = new LinkedHashMap<>();
    for (String id : List.of("fib-scrum","fib-enh","fib-math","pow2","tshirt")) {
      String norm = CardSequences.normalizeSequenceId(id);
      List<String> deck = CardSequences.buildDeck(norm);
      if (deck != null && !deck.isEmpty()) {
        seqs.put(norm, deck);
      }
    }
    return Map.of("sequences", seqs);
  }
}
