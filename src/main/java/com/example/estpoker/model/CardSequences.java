package com.example.estpoker.model;

import java.text.NumberFormat;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Central registry and helpers for estimation card sequences,
 * special cards (including ID↔emoji mapping), numeric parsing, and stats.
 */
public final class CardSequences {

    private CardSequences() {}

    // ---------------------------------------------------------------------
    // Special cards
    // ---------------------------------------------------------------------

    /** Canonical special emojis (includes the base "question" card). */
    public static final String QUESTION   = "❓";
    public static final String COFFEE     = "☕";
    public static final String SPEECH     = "💬";
    public static final String TELESCOPE  = "🔭";
    public static final String WAITING    = "⏳";
    public static final String DEPENDENCY = "🔗";
    public static final String RISK       = "⚠️";
    public static final String RELEVANCE  = "🎯";

    /**
     * All known special emojis. The "question" card is included here as well for
     * classification; clients may always render it even if extras are disabled.
     */
    public static final List<String> SPECIALS = List.of(
            QUESTION, COFFEE, SPEECH, TELESCOPE, WAITING, DEPENDENCY, RISK, RELEVANCE
    );

    public static final Set<String> SPECIALS_SET = new HashSet<>(SPECIALS);

    /** Ordered list of special IDs used in a palette/menu (no "question" here). */
    public static final List<String> SPECIAL_IDS_ORDER = List.of(
            "coffee", "speech", "telescope", "waiting", "dependency", "risk", "relevance"
    );

    /** ID → emoji (stable insertion order). */
    public static final Map<String, String> SPECIALS_ID_TO_EMOJI;
    /** Emoji → ID (includes "question" → "question"). */
    public static final Map<String, String> SPECIALS_EMOJI_TO_ID;

    static {
        LinkedHashMap<String, String> id2e = new LinkedHashMap<>();
        id2e.put("coffee",     COFFEE);
        id2e.put("speech",     SPEECH);
        id2e.put("telescope",  TELESCOPE);
        id2e.put("waiting",    WAITING);
        id2e.put("dependency", DEPENDENCY);
        id2e.put("risk",       RISK);
        id2e.put("relevance",  RELEVANCE);
        SPECIALS_ID_TO_EMOJI = Collections.unmodifiableMap(id2e);

        Map<String, String> e2id = new HashMap<>();
        for (Map.Entry<String, String> e : id2e.entrySet()) {
            e2id.put(e.getValue(), e.getKey());
        }
        // Optional mapping for the base "question" special
        e2id.putIfAbsent(QUESTION, "question");
        SPECIALS_EMOJI_TO_ID = Collections.unmodifiableMap(e2id);
    }

    /** True if the given label is a known special emoji (incl. question). */
    public static boolean isSpecial(String s) {
        return s != null && SPECIALS_SET.contains(s);
    }

    /** True if the given ID is a known special ID (excludes "question"). */
    public static boolean isSpecialId(String id) {
        return id != null && SPECIALS_ID_TO_EMOJI.containsKey(id.trim());
    }

    /**
     * Map a collection of special IDs (e.g. ["coffee","speech"]) to emojis (["☕","💬"]),
     * preserving insertion order and removing unknowns/duplicates.
     */
    public static List<String> idsToEmojis(Collection<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        LinkedHashSet<String> want = new LinkedHashSet<>();
        for (String id : ids) {
            if (id == null) continue;
            String e = SPECIALS_ID_TO_EMOJI.get(id.trim());
            if (e != null) want.add(e);
        }
        return List.copyOf(want);
    }

    /**
     * Map a collection of emojis (e.g. ["☕","💬"]) to IDs (["coffee","speech"]),
     * removing unknowns/duplicates. "❓" maps to "question".
     */
    public static List<String> emojisToIds(Collection<String> emojis) {
        if (emojis == null || emojis.isEmpty()) return List.of();
        LinkedHashSet<String> want = new LinkedHashSet<>();
        for (String em : emojis) {
            if (em == null) continue;
            String id = SPECIALS_EMOJI_TO_ID.get(em.trim());
            if (id != null) want.add(id);
        }
        return List.copyOf(want);
    }

    // ---------------------------------------------------------------------
    // Aliases → numeric value (for averages)
    // ---------------------------------------------------------------------

    private static final Map<String, Double> ALIASES = Map.of(
            "½",   0.5,
            "1/2", 0.5,
            "0,5", 0.5
    );

    // ---------------------------------------------------------------------
    // Sequences
    // ---------------------------------------------------------------------

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

    /**
     * Build a deck from a sequence. This method appends all specials as defined
     * by {@link #SPECIALS}. Callers that need stricter control over which specials
     * to include should filter the result or use {@link #buildDeck(String, Collection)}.
     */
    public static List<String> buildDeck(String seqId) {
        String id = normalizeSequenceId(seqId);
        List<String> base = SEQUENCES.get(id);
        List<String> out = new ArrayList<>(base.size() + SPECIALS.size());
        out.addAll(base);
        out.addAll(SPECIALS);
        return out;
    }

    /**
     * Build a deck from a sequence and an allowed set of special emojis.
     * Unknown specials are ignored. If {@code allowedSpecials} is null,
     * all specials are appended.
     */
    public static List<String> buildDeck(String seqId, Collection<String> allowedSpecials) {
        String id = normalizeSequenceId(seqId);
        List<String> base = SEQUENCES.get(id);
        List<String> out = new ArrayList<>(base.size() + SPECIALS.size());
        out.addAll(base);

        if (allowedSpecials == null) {
            out.addAll(SPECIALS);
        } else {
            for (String s : allowedSpecials) {
                if (isSpecial(s)) out.add(s);
            }
        }
        return out;
    }

    public static Set<String> allSequenceIds() {
        return SEQUENCES.keySet();
    }

    // ---------------------------------------------------------------------
    // Parsing helpers
    // ---------------------------------------------------------------------

    /** Returns true if the value represents infinity (either "∞" or "♾️"). */
    public static boolean isInfinity(String s) {
        if (s == null) return false;
        String t = s.trim();
        return INFINITY.equals(t) || INFINITY_EMOJI.equals(t);
    }

    // ---------------------------------------------------------------------
    // Parsing & basic averaging
    // ---------------------------------------------------------------------

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

    // ---------------------------------------------------------------------
    // Extended statistics: median, range, consensus, outlier
    // ---------------------------------------------------------------------

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
