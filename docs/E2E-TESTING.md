# E2E Testing with Playwright

This guide explains how we keep the app reliably testable and how to run, debug, and stabilize the Playwright E2E suite. It complements the high‑level project briefing and is meant to be copy‑and‑paste friendly.

---

## 1) Scope & Philosophy

- Tests must work across **multiple UI variants** (local/prod/e2e profiles, legacy DOM differences).
- Prefer **attribute-driven locators** and **ARIA/state checks** over brittle CSS.
- Hide environment differences behind **helpers** so individual tests stay succinct.
- When a feature is optional (e.g., stats row), tests should **prove the behavior** via alternative signals (chips, events) instead of failing on missing elements.

---

## 2) Prerequisites

- Node.js & npm (from project toolchain)
- Playwright browsers and deps
  ```bash
  npm ci
  npx playwright install --with-deps
  ```
- A running **app server**. You can use one of these approaches:
  - **Local Spring Boot profile**
    ```bash
    ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
    ```
  - **Stable test JAR with a dedicated profile** (recommended for low flakiness)
    ```bash
    java -jar target/estpoker-<version>.jar --spring.profiles.active=e2e
    ```

> The E2E suite targets whatever base URL you set via `EP_BASE_URL` (defaults depend on your local env).

---

## 3) Quickstart: run a subset or the whole suite

### Run a single spec (with trace on failure and one retry)
```bash
EP_BASE_URL=http://localhost:8080 npx playwright test tests/specials-stats.spec.ts   -c playwright.config.ts --trace=retain-on-failure --retries=1
```

### Run multiple focused specs
```bash
EP_BASE_URL=http://localhost:8080 npx playwright test tests/persistence.spec.ts tests/reset-flow.spec.ts tests/sequence-change.spec.ts tests/specials-stats.spec.ts   -c playwright.config.ts --trace=retain-on-failure --retries=1
```

### Run the full suite
```bash
EP_BASE_URL=http://localhost:8080 npx playwright test -c playwright.config.ts --retries=1 --trace=retain-on-failure
```

### Open the HTML report / view a trace
```bash
npx playwright show-report
# Or for a specific saved trace
npx playwright show-trace test-results/<...>/trace.zip
```

---

## 4) Project config essentials

- `playwright.config.ts`:
  - Single project by default; we select Chromium implicitly (no named projects necessary).
  - `retries` and `use: { trace: 'retain-on-failure' }` are tuned for stability.
- `tests/tsconfig.json`:
  - Strict enough to catch flaky code patterns; build sanity check:
    ```bash
    npm run e2e:buildcheck   # runs: tsc -p tests/tsconfig.json --noEmit
    ```

---

## 5) Canonical helpers (import from `tests/utils/helpers.ts`)

> Use helpers wherever possible instead of ad‑hoc locators. They encapsulate multiple DOM variants and robust waiting rules.

```ts
import {
  ensureMenuOpen, ensureMenuClosed,
  clickByValue, hasCoffeeCard,
  revealNow, resetNow, revealedNow,
  readAverage, readNumericChips,
  readDeckValues, pickTwoNumeric, voteAnyNumber,
  setSequence, waitSequenceOn, waitSequenceSync
} from './utils/helpers';
```

### What they do (high level):

- **ensureMenuOpen/ensureMenuClosed(page)**  
  Attribute‑based toggling (`aria-hidden`) with resilient waits.

- **readDeckValues(page)**  
  Returns the visible deck as strings using several fallbacks (`data-value`, `data-card`, textual content).

- **clickByValue(page, value)**  
  Clicks a card by data attributes or text, with exact and fuzzy matches.

- **hasCoffeeCard(page)**  
  Detects the ☕ card using multiple selectors.

- **revealNow(page)**  
  Reveals the round via visible button, menu action, or final event fallback (`window.revealCards()` / custom event).

- **resetNow(page)**  
  Resets via visible button or menu action.

- **revealedNow(page, timeoutMs)**  
  Waits for a revealed state using presence of results panel or non‑empty chip list.

- **readAverage(page)**  
  Attempts to read the average from known locations; if absent, returns `null` (tests can fall back to computing from visible numeric chips).

- **readNumericChips(page)**  
  Extract numeric votes from result chips (post‑reveal).

- **pickTwoNumeric(page)**  
  Ensure a numeric-friendly sequence is active (switch if needed) and return two numeric values to vote with.

- **voteAnyNumber(page)**  
  Pick any numeric card when only “some numeric” is required.

- **setSequence(page, id)**  
  Change the deck sequence using radios, labels, or event fallback. Closes the menu and allows the UI to rebuild.

- **waitSequenceOn(page, id, timeoutMs)**  
  Wait until a specific sequence id becomes selected on a page.

- **waitSequenceSync(host, guest, id, timeoutMs)**  
  Wait until both sides show the same selected sequence id.

---

## 6) Patterns that reduce flakiness

- **Prefer attributes over CSS visibility**  
  Waiting on `aria-hidden="false"` for overlays is more stable than checking computed styles.

- **Avoid `:has-text()` in selectors if CSS engines differ**  
  Use Playwright’s built‑in `getByRole/getByText` or explicit `.filter({ hasText })` where needed.

- **Drive the app through _capabilities_**  
  For “reveal” and “reset” do not rely only on a visible button. Check menu entries and fall back to events.

- **Time-box reads**  
  `readAverage` returns `null` quickly if the average is not explicitly rendered—tests then compute expectations from visible chips instead of failing.

- **Normalize numerics**  
  Always parse numbers with `replace(',', '.')` and compare with tolerances.

- **Keep selectors co-located**  
  If a DOM detail evolves, fix it once in a helper, not in N tests.

---

## 7) CI recipe (example)

```bash
# 1) Install node deps and browsers
npm ci
npx playwright install --with-deps

# 2) Start the app with a predictable profile
java -jar target/estpoker-<version>.jar --spring.profiles.active=e2e &
APP_PID=$!
trap 'kill $APP_PID || true' EXIT
sleep 3

# 3) Run a sanity compile of the tests (fast)
npm run e2e:buildcheck

# 4) Run tests with traces on failure
EP_BASE_URL=http://localhost:8080 npx playwright test -c playwright.config.ts --retries=1 --trace=retain-on-failure
```

Artifacts to keep: `playwright-report/`, `test-results/` (traces/videos).

---

## 8) Troubleshooting quick table

| Symptom | Likely cause | What to try |
|---|---|---|
| “Element is not visible” on reveal/reset | Button not visible in this build/profile | Use `revealNow`/`resetNow` (already in tests). Ensure menu can open; check `aria-hidden` waits. |
| Missing average value | Stats row hidden in this build | Use `readNumericChips` and compute the mean; accept `readAverage()` returning `null`. |
| Guest didn’t sync sequence | Slow WS/event propagation | Use `waitSequenceOn()` or `waitSequenceSync()` with a slightly longer timeout (≤ 4s). |
| Can’t click a card by text | Localized content/spacing | `clickByValue()` already tries data attributes and regex text matches. |
| Flaky overlay state | CSS animation timings | Always go via `ensureMenuOpen/Closed()`; they poll `aria-hidden`. |

---

## 9) Handy commands

```bash
# Compile tests only (sanity)
npm run e2e:buildcheck

# Run a specific test title
EP_BASE_URL=http://localhost:8080 npx playwright test -g "Auto-Reveal" -c playwright.config.ts --trace=on

# Debug interactively
EP_BASE_URL=http://localhost:8080 PWDEBUG=1 npx playwright test tests/sequence-change.spec.ts -c playwright.config.ts
```

---

**Last updated:** keep this file in sync whenever helpers or selectors change.
