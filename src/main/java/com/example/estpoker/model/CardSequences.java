package com.example.estpoker.model;

import java.util.*;

public final class CardSequences {
    private CardSequences() {}

    public static final String DEFAULT_ID = "fib-scrum";

    private static final Map<String, List<String>> BASE = Map.of(
        "fib-orig",  List.of("0","1","2","3","5","8","13","21","34","55"),
        DEFAULT_ID,  List.of("1","2","3","5","8","13","20","40"),
        "fib-enh",   List.of("0","1/2","1","2","3","5","8","13","20","40"),
        "pow2",      List.of("2","4","8","16","32"),
        "tshirt",    List.of("XS","S","M","L","XL","XXL","XXXL")
    );

    private static final List<String> SPECIALS = List.of("❓","💬","☕");

    public static String normalize(String id) {
        return BASE.containsKey(id) ? id : DEFAULT_ID;
    }

    public static List<String> deckWithSpecials(String id) {
        String k = normalize(id);
        List<String> d = new ArrayList<>(BASE.get(k));
        d.addAll(SPECIALS);
        return d;
    }
}
