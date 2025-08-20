package com.example.estpoker.model;

import java.text.NumberFormat;
import java.util.*;
import java.util.stream.Collectors;

public final class CardSequences {

    /** Specials in fester Reihenfolge für die Anzeige (UI-Reihenfolge). */
    public static final List<String> SPECIALS = List.of("❓","💬","☕");

    /** Set nur für schnelle Mitgliedstests (Reihenfolge egal). */
    public static final Set<String> SPECIALS_SET = new HashSet<>(SPECIALS);

    /** Anzeige-Aliasse -> Zahlenwert (für Durchschnitt). */
    private static final Map<String, Double> ALIASES = Map.of(
        "½",   0.5,   // U+00BD
        "1/2", 0.5,
        "0,5", 0.5
    );

    /** Deine Kartensätze (IDs synchron zu Room.SEQ_BASE). */
    public static final Map<String, List<String>> SEQUENCES = Map.of(
        "fib-math",  List.of("0","1","2","3","5","8","13","21","34","55"),
        "fib-scrum", List.of("1","2","3","5","8","13","20","40"),
        "fib-enh",   List.of("0","½","1","2","3","5","8","13","20","40"),
        "pow2",      List.of("2","4","8","16","32","64","128"),
        "tshirt",    List.of("XXS","XS","S","M","L","XL","XXL","XXXL")
    );

    private CardSequences(){}

    /** Versucht, einen Kartenwert in eine Zahl zu übersetzen. */
    public static OptionalDouble parseNumeric(String s) {
        if (s == null) return OptionalDouble.empty();
        s = s.trim();
        if (s.isEmpty() || SPECIALS_SET.contains(s)) return OptionalDouble.empty();

        // Alias (½, 1/2, 0,5 ...)
        Double alias = ALIASES.get(s);
        if (alias != null) return OptionalDouble.of(alias);

        // Bruch a/b
        if (s.matches("\\d+\\s*/\\s*\\d+")) {
            try {
                String[] p = s.split("/");
                double a = Double.parseDouble(p[0].trim());
                double b = Double.parseDouble(p[1].trim());
                if (b != 0) return OptionalDouble.of(a / b);
            } catch (NumberFormatException ignore) {}
            return OptionalDouble.empty();
        }

        // Dezimal mit Komma oder Punkt
        try {
            return OptionalDouble.of(Double.parseDouble(s.replace(',', '.')));
        } catch (NumberFormatException e) {
            return OptionalDouble.empty();
        }
    }

    /** Durchschnitt aus Stimmen (Strings). Specials werden ignoriert. */
    public static OptionalDouble averageOfStrings(Collection<String> votes) {
        if (votes == null) return OptionalDouble.empty();
        return votes.stream()
                .map(CardSequences::parseNumeric)
                .filter(OptionalDouble::isPresent)
                .mapToDouble(OptionalDouble::getAsDouble)
                .average();
    }

    /** Schönes Format für die Anzeige (z.B. nach Locale deutsch mit Komma). */
    public static String formatAverage(OptionalDouble avgOpt, Locale locale) {
        if (avgOpt == null || avgOpt.isEmpty()) return "–";
        NumberFormat nf = NumberFormat.getNumberInstance(locale != null ? locale : Locale.getDefault());
        nf.setMaximumFractionDigits(2);
        nf.setMinimumFractionDigits(0);
        return nf.format(avgOpt.getAsDouble());
    }
}
