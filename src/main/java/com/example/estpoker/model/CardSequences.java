package com.example.estpoker.model;

import java.text.NumberFormat;
import java.util.*;

/**
 * Central registry and helpers for estimation card sequences,
 * special cards, parsing numeric values, and average formatting.
 */
public final class CardSequences {

    private CardSequences() {}

    /* --- Specials --- */
    // Fixed order for the deck (UI)
    public static final List<String> SPECIALS = List.of("❓","💬","☕");
    // Fast membership check for logic/parsing
    public static final Set<String> SPECIALS_SET = new HashSet<>(SPECIALS);

    /** Convenience helper: check if a value is a special card. */
    public static boolean isSpecial(String s) {
        return s != null && SPECIALS_SET.contains(s);
    }

    /* --- Aliases -> numeric value (for averages) --- */
    private static final Map<String, Double> ALIASES = Map.of(
        "½",   0.5,
        "1/2", 0.5,
        "0,5", 0.5
    );

    /* --- Sequence registry (central) --- */
    public static final String DEFAULT_SEQUENCE_ID = "fib-scrum";

    /** Public registry in case UI/server wants to list the keys. */
    public static final Map<String, List<String>> SEQUENCES = Map.of(
        // Fibonacci (mathematical)
        "fib-math",  List.of("0","1","2","3","5","8","13","21","34","55"),
        // Fibonacci (Scrum – without 100)
        "fib-scrum", List.of("1","2","3","5","8","13","20","40"),
        // Fibonacci (Scrum enhanced – includes 0, ½ and 100)
        "fib-enh",   List.of("0","½","1","2","3","5","8","13","20","40","100"),
        // Powers of two – up to 128 (consistent with previous Room.java)
        "pow2",      List.of("2","4","8","16","32","64","128"),
        // T-Shirt sizes
        "tshirt",    List.of("XXS","XS","S","M","L","XL","XXL","XXXL")
    );

    /** Normalize unknown IDs to the default ID. */
    public static String normalizeSequenceId(String seqId) {
        return (seqId != null && SEQUENCES.containsKey(seqId)) ? seqId : DEFAULT_SEQUENCE_ID;
    }

    /**
     * Returns the full deck = base sequence + SPECIALS (in fixed order).
     * Unknown IDs are normalized to DEFAULT.
     */
    public static List<String> buildDeck(String seqId) {
        String id = normalizeSequenceId(seqId);
        List<String> base = SEQUENCES.get(id);
        List<String> out = new ArrayList<>(base.size() + SPECIALS.size());
        out.addAll(base);
        out.addAll(SPECIALS);
        return out;
    }

    /** All valid sequence IDs (e.g., for UI dropdowns). */
    public static Set<String> allSequenceIds() {
        return SEQUENCES.keySet();
    }

    /* --- Parsing & averaging --- */

    /** Try to parse a card value into a number. Specials yield empty. */
    public static OptionalDouble parseNumeric(String s) {
        if (s == null) return OptionalDouble.empty();
        s = s.trim();
        if (s.isEmpty() || SPECIALS_SET.contains(s)) return OptionalDouble.empty();

        // Aliases (½, 1/2, 0,5 ...)
        Double alias = ALIASES.get(s);
        if (alias != null) return OptionalDouble.of(alias);

        // Fraction a/b
        if (s.matches("\\d+\\s*/\\s*\\d+")) {
            try {
                String[] p = s.split("/");
                double a = Double.parseDouble(p[0].trim().replace(',','.'));
                double b = Double.parseDouble(p[1].trim().replace(',','.'));
                if (b != 0) return OptionalDouble.of(a / b);
            } catch (NumberFormatException ignore) {}
            return OptionalDouble.empty();
        }

        // Decimal with comma or dot
        try {
            return OptionalDouble.of(Double.parseDouble(s.replace(',', '.')));
        } catch (NumberFormatException e) {
            return OptionalDouble.empty();
        }
    }

    /** Average over string votes. Specials are ignored. */
    public static OptionalDouble averageOfStrings(Collection<String> votes) {
        if (votes == null) return OptionalDouble.empty();
        return votes.stream()
                .map(CardSequences::parseNumeric)
                .filter(OptionalDouble::isPresent)
                .mapToDouble(OptionalDouble::getAsDouble)
                .average();
    }

    /** Nicely formatted average (locale-aware, max 2 fraction digits). */
    public static String formatAverage(OptionalDouble avgOpt, Locale locale) {
        if (avgOpt == null || avgOpt.isEmpty()) return "–";
        NumberFormat nf = NumberFormat.getNumberInstance(
                (locale != null ? locale : Locale.getDefault()));
        nf.setMaximumFractionDigits(2);
        nf.setMinimumFractionDigits(0);
        return nf.format(avgOpt.getAsDouble());
    }
}
