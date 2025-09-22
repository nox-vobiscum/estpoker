# UI Style Guide (Tokens & Layout)

This document defines the design tokens and layout rules used across the app.  
The goal is to keep contributions consistent and make global tweaks easy.

## Principles
- **Clarity over decoration**: content and decisions first.
- **Consistency via tokens**: never hard-code ad-hoc sizes if a token exists.
- **Accessible by default**: readable line-heights, contrast, and tap targets.

## Tokens

Declare tokens in CSS (see snippet below). Suggested defaults:

| Token | Default | Notes |
|------|---------|-------|
| `--font-size-sm` | `0.875rem` | Small UI text / badges |
| `--font-size-md` | `1rem`     | Base body text |
| `--font-size-lg` | `1.125rem` | Prominent labels / section headers |
| `--lh-tight`     | `1.25`     | Controls / headers |
| `--lh-normal`    | `1.5`      | Body text |
| `--space-1`      | `0.25rem`  | XS spacing |
| `--space-2`      | `0.5rem`   | S spacing |
| `--space-3`      | `0.75rem`  | M spacing |
| `--space-4`      | `1rem`     | L spacing |
| `--radius-sm`    | `4px`      | Small rounding |
| `--radius-md`    | `8px`      | Default rounding |

**Compact mode overrides** (activated by `.compact` on `<body>`):
- Slightly smaller font sizes (`-0.0625–0.125rem`)
- Tighter line-height (`--lh-tight: 1.2`)
- Reduced paddings (`-1 step` on `--space-*` where sensible)

## CSS boilerplate

Add this to your main stylesheet (e.g., `styles.css`):

```css
:root {
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.125rem;

  --lh-tight: 1.25;
  --lh-normal: 1.5;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;

  --radius-sm: 4px;
  --radius-md: 8px;
}

/* Compact mode: applied via <body class="compact"> */
body.compact {
  --font-size-sm: 0.8125rem;
  --font-size-md: 0.9375rem;
  --font-size-lg: 1.0625rem;

  --lh-tight: 1.2;

  --space-1: 0.2rem;
  --space-2: 0.4rem;
  --space-3: 0.6rem;
  --space-4: 0.8rem;
}

/* Example usage */
.topbar {
  font-size: var(--font-size-md);
  line-height: var(--lh-tight);
  padding: var(--space-2) var(--space-3);
}

.button {
  font-size: var(--font-size-sm);
  line-height: var(--lh-tight);
  padding: calc(var(--space-1) + 2px) var(--space-2);
  border-radius: var(--radius-md);
}

.topic-row .topic-text {
  font-size: var(--font-size-md);
  line-height: var(--lh-normal);
}

/* Keep minimum tap targets even in compact mode */
.button, .icon-button {
  min-height: 36px;
  min-width: 36px;
}
