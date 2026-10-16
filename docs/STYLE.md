# UI Style Guide (Tokens & Layout)

This document defines the design tokens and layout rules used across the app.  
The goal is to keep contributions consistent and make global tweaks easy.

## Principles
- **Clarity over decoration**: content and decisions first.
- **Consistency via tokens**: never hard-code ad-hoc sizes if a token exists.
- **Accessible by default**: readable line-heights, contrast, and tap targets.

## Visual semantics

- System states use quiet, neutral and monochrome symbols. They must not look like deliberate votes or game actions.
- Selected estimates and special cards may use distinctive color or personality when this communicates meaning.
- Results remain factual and restrained. The consensus celebration symbol is an intentional exception.
- Icons convey information or an available action; avoid purely decorative icons and never reuse voting semantics for system status.

## Editorial language

- German user-facing text uses natural inclusive wording such as `Teilnehmende`, `Zuschauende`, `Nutzende` or direct address.
- Established English product and role terms remain unchanged in German, including `Host`, `Scrum Master`, `Product Owner`, `Developer`, `Stakeholder`, `Planning Poker`, `Story Points` and `User Story`.
- English text expresses the same behavior naturally rather than mirroring German sentence structure.
- Labels and documentation describe verified behavior without promises about fixed timing, persistence or availability.

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

## Appearance and preferences

- **Theme:** Light, Dark or System. System follows `prefers-color-scheme` and
  is represented by the absence of a `data-theme` attribute.
- Geometry, typography and surfaces use one shared set of interface tokens.

`ui-preferences.js` (`window.PPUI`) owns language and theme.
`menu.js` owns the menu lifecycle only. Presentation preferences are local to
each user and are not synchronized room settings.

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

/* Keep minimum tap targets across themes */
.button, .icon-button {
  min-height: 36px;
  min-width: 36px;
}
