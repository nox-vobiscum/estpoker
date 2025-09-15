package com.example.estpoker.model;

import java.text.NumberFormat;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Central registry and helpers for estimation card sequences,
 * special cards, parsing numeric values, and stats/formatting.
 */
public final class CardSequences {

    private CardSequences() {}

    /* --- Specials (global, appended to every deck) --- */
    public static final List<String> SPECIALS = List.of("❓","☕");
    public static final Set<String> SPECIALS_SET = new HashSet<>(SPECIALS);

    public static boolean isSpecial(String s) {
        return s != null && SPECIALS_SET.contains(s);
    }

    /* --- Aliases -> numeric value (for averages) --- */
    private static final Map<String, Double> ALIASES = Map.of(
        "½",   0.5,
        "1/2", 0.5,
        "0,5", 0.5
    );

    /* --- Sequence registry (unified to dot-notation) --- */
    public static final String DEFAULT_SEQUENCE_ID = "fib.scrum";

    /** ASCII infinity sign used by some old clients. */
    public static final String INFINITY = "\u221E"; // "∞"
    /** Emoji infinity (preferred visual in UI). */
    public static final String INFINITY_EMOJI = "♾️";

    public static final Map<String, List<String>> SEQUENCES = Map.of(
        "fib.math",  List.of("0","1","2","3","5","8","13","21","34","55","89"),
        "fib.scrum", List.of("1","2","3","5","8","13","20","40"),
        // Infinity appears only in the enhanced Fibonacci sequence (UI-only card, excluded from stats)
        "fib.enh",   List.of("0","½","1","2","3","5","8","13","20","40","100","♾️"),
        "pow2",      List.of("2","4","8","16","32","64","128"),
        "tshirt",    List.of("XXS","XS","S","M","L","XL","XXL","XXXL")
    );

    public static String normalizeSequenceId(String seqId) {
        return (seqId != null && SEQUENCES.containsKey(seqId)) ? seqId : DEFAULT_SEQUENCE_ID;
    }

    /** Full deck = base sequence + SPECIALS. */
    public static List<String> buildDeck(String seqId) {
        String id = normalizeSequenceId(seqId);
        List<String> base = SEQUENCES.get(id);
        List<String> out = new ArrayList<>(base.size() + SPECIALS.size());
        out.addAll(base);
        out.addAll(SPECIALS);
        return out;
    }

    public static Set<String> allSequenceIds() {
        return SEQUENCES.keySet();
    }

    /* --- Parsing helpers --- */

    /** Returns true if the value represents infinity (either "∞" or "♾️"). */
    public static boolean isInfinity(String s) {
        if (s == null) return false;
        String t = s.trim();
        return INFINITY.equals(t) || INFINITY_EMOJI.equals(t);
    }

    /* --- Parsing & basic averaging --- */

    public static OptionalDouble parseNumeric(String s) {
        if (s == null) return OptionalDouble.empty();
        s = s.trim();
        if (s.isEmpty() || SPECIALS_SET.contains(s)) return OptionalDouble.empty();
        if (isInfinity(s)) return OptionalDouble.empty(); // treat infinity as non-numeric

        Double alias = ALIASES.get(s);
        if (alias != null) return OptionalDouble.of(alias);

        if (s.matches("\\d+\\s*/\\s*\\d+")) {
            try {
                String[] p = s.split("/");
                double a = Double.parseDouble(p[0].trim().replace(',','.'));
                double b = Double.parseDouble(p[1].trim().replace(',','.'));
                if (b != 0) return OptionalDouble.of(a / b);
            } catch (NumberFormatException ignore) {}
            return OptionalDouble.empty();
        }

        try {
            return OptionalDouble.of(Double.parseDouble(s.replace(',', '.')));
        } catch (NumberFormatException e) {
            return OptionalDouble.empty();
        }
    }

    public static OptionalDouble averageOfStrings(Collection<String> votes) {
        if (votes == null) return OptionalDouble.empty();
        return votes.stream()
                .map(CardSequences::parseNumeric)
                .filter(OptionalDouble::isPresent)
                .mapToDouble(OptionalDouble::getAsDouble)
                .average();
    }

    public static String formatAverage(OptionalDouble avgOpt, Locale locale) {
        if (avgOpt == null || avgOpt.isEmpty()) return "–";
        return formatNumber(avgOpt.getAsDouble(), locale);
    }

    public static String formatNumber(double value, Locale locale) {
        NumberFormat nf = NumberFormat.getNumberInstance(
                (locale != null ? locale : Locale.getDefault()));
        nf.setMaximumFractionDigits(2);
        nf.setMinimumFractionDigits(0);
        return nf.format(value);
    }

    /* --- Extended statistics: median, range, consensus, outlier --- */

    public static OptionalDouble medianOfStrings(Collection<String> votes) {
        if (votes == null) return OptionalDouble.empty();
        List<Double> nums = votes.stream()
                .map(CardSequences::parseNumeric)
                .filter(OptionalDouble::isPresent)
                .map(OptionalDouble::getAsDouble)
                .sorted()
                .collect(Collectors.toList());
        int n = nums.size();
        if (n == 0) return OptionalDouble.empty();
        if (n % 2 == 1) {
            return OptionalDouble.of(nums.get(n / 2));
        } else {
            return OptionalDouble.of((nums.get(n / 2 - 1) + nums.get(n / 2)) / 2.0);
        }
    }

    public static Optional<Range> rangeOfStrings(Collection<String> votes) {
        if (votes == null) return Optional.empty();
        boolean found = false;
        double min = Double.POSITIVE_INFINITY;
        double max = Double.NEGATIVE_INFINITY;
        for (String v : votes) {
            OptionalDouble od = parseNumeric(v);
            if (od.isEmpty()) continue;
            double d = od.getAsDouble();
            if (d < min) min = d;
            if (d > max) max = d;
            found = true;
        }
        return found ? Optional.of(new Range(min, max)) : Optional.empty();
    }

    public static boolean isConsensus(Collection<String> votes) {
        if (votes == null) return false;

        // If any infinity is present, there is no consensus by definition.
        for (String v : votes) {
            if (isInfinity(v)) return false;
        }

        Double first = null;
        for (String v : votes) {
            OptionalDouble od = parseNumeric(v);
            if (od.isEmpty()) continue;
            double d = od.getAsDouble();
            if (first == null) first = d;
            else if (!equalsEps(first, d)) return false;
        }
        return first != null;
    }

    /** Outlier candidate (farthest from average), only if >= 3 numeric votes. */
    public static OptionalDouble farthestFromAverage(Collection<String> votes) {
        if (votes == null) return OptionalDouble.empty();
        double[] arr = votes.stream()
                .map(CardSequences::parseNumeric)
                .filter(OptionalDouble::isPresent)
                .mapToDouble(OptionalDouble::getAsDouble)
                .toArray();
        if (arr.length < 3) return OptionalDouble.empty();

        double avg = Arrays.stream(arr).average().orElse(Double.NaN);
        double best = arr[0];
        double bestDist = Math.abs(best - avg);
        for (int i = 1; i < arr.length; i++) {
            double v = arr[i];
            double d = Math.abs(v - avg);
            if (d > bestDist) { bestDist = d; best = v; }
        }
        return OptionalDouble.of(best);
    }

    private static boolean equalsEps(double a, double b) {
        return Math.abs(a - b) <= 1e-9;
    }

    /** Inclusive numeric range. */
    public static record Range(double min, double max) {}
}
