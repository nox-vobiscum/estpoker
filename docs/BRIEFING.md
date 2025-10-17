# Estimation Poker – Project Briefing

This document introduces the project, how to contribute, how to run it locally, and how to _not_ break production 😅.

---

## 1) Elevator pitch
A tiny, server‑backed estimation poker tool with a minimal UI that stays reliable under weak networks and mobile browsers. Focus is a **clean workshop flow**: join → pick → reveal → reset.

## 2) Technology stack
- **Server**: Spring Boot (WebMVC + WebSocket), Java 17
- **Frontend**: Vanilla JS + HTML, no build step, progressive enhancement
- **Data**: In‑memory + optional FTPS snapshots (prod)
- **Tests**: JUnit 5 (unit/integration), **Playwright** (E2E)

## 3) Run locally (dev friendly)
```bash
# Terminal A: build the app
./mvnw clean package

# Terminal B: run with local profile (static resources served from target/classes)
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
# open http://localhost:8080
```

## 4) Configuration profiles
- `local` — fast reload during development
- `e2e`   — stable profile for deterministic E2E runs
- `prod`  — the deployed service (see Koyeb manifest)

## 5) WebSocket protocol (very small)
- Client connects to `/gameSocket?roomCode=...&participantName=...&cid=...`
- Text frames for simple commands:
  - `vote:<name>:<label>`
  - `revealCards` / `resetRoom`
  - `sequence:<id>` (aka `seq:`/`setSequence:` for compatibility)
  - a few toggles: `autoReveal:true|false`, `topicVisible:true|false`, `participation:true|false`, etc.
- Server pushes **JSON** room snapshots as `{ type: 'voteUpdate', ... }`

## 6) Liveness features
- Heartbeat ping every 15s, watchdog reconnect after 20s stale
- Reconnect with exponential backoff + jitter
- Wake‑ups on `visibilitychange`/`focus`/`online`/`pageshow`

## 7) Accessibility
- Keyboard support on all primary actions
- Screen‑reader announcements for result stats
- Labels / aria-* kept in sync with UI state

## 8) Contributing
- Small PRs
- Prefer “one behavioral change + tests” per PR
- No libraries for the frontend; keep it portable

## 9) Testing
- `mvn test` for unit/integration (JUnit 5)
- `npx playwright test` for E2E (see `docs/E2E-TESTING.md`)

## 10) Deployment
- Koyeb via `koyeb.yaml`
- FTPS‑backed snapshots are optional and off for local/e2e

## 11) Room model (very small, server side)
- Participants: name, vote, roles (host), flags (away/disconnected/spectator)
- Settings: sequenceId, allowSpecials, topic (label/url), autoReveal, etc.
- Derived: average, median, range, consensus, outliers

## 12) UI layout (very small, client side)
- **Cards grid** with selectable buttons (numbers + specials)
- **Result bar** that appears only after reveal
- **Menu overlay** with toggles and sequence radios
- **Participant list** with host crown and spectator eye

## 13) Release hygiene
- Keep main stable (prod mirrors it)
- Use `docs/adr` for notable decisions
- Update docs when test contracts or selectors change
---

## 16) Frontend *testability contracts* (room.js)

These guarantees keep our E2E tests green **without adding helpers or debt**. They are part of the UI contract and must stay stable.

- **Sequence change event bridge.** The frontend listens to *both* `document` **and** `window` for `ep:sequence-change` and accepts
  `detail.id` **or** `detail.sequenceId`. Host‑gate is respected when known; otherwise we optimistically apply and let the server confirm.
  ```js
  // room.js
  function onSeq(ev) {
    const id = normalizeSeq(ev?.detail?.id || ev?.detail?.sequenceId);
    if (!id) return;
    if (state._hostKnown && !state.isHost) return;
    applyLocalSequence(id);
    notifySequence(id); // emits 'sequence:' + sync nudge
  }
  document.addEventListener('ep:sequence-change', onSeq);
  window.addEventListener('ep:sequence-change', onSeq);
  ```

- **Bootstrap deck before first WS echo.** On boot we call `ensureBootstrapDeck()` and `renderCards()` so the grid is usable immediately.
  Infinity (♾️/∞) is present **only** for `fib.enh`. Specials honor `allowSpecials` and `data-disabled-specials`.

- **Immediate UI mirror for participation.** Toggling participation locally updates `state.selfSpectator` and the user’s row instantly
  (eye icon 👁 / disabled buttons) **before** the server echo, then sends `participation:true|false`.

- **Server payload bus for tests.** Every parsed WS JSON message is pushed into a ring buffer `window.__epVU` so tests can read last
  `voteUpdate.sequenceId` without scraping DOM.

- **Early readiness signal.** We set `document.documentElement[data-ready="1"]` as soon as the grid/menu are wired and a placeholder
  participant is seeded. Tests wait on this instead of brittle CSS timing.

- **Host‑gated menu toggles revert for guests.** When the host role is known, guest flips on menu switches are immediately reverted and
  `aria-checked` is kept in sync to avoid flakiness.

- **Sequence radio reconciliation.** We update *all* radios reflecting the same value, observe `checked` mutations, and reconcile programmatic
  flips (covers `.check()`, label clicks, or DOM swaps).

- **Name preflight only once per (room+name)+tab.** Guarded via `sessionStorage` and honored `?preflight=1` param used by tests to skip checks.

## 17) Test interfaces you may rely on

- **Custom events (document or window):**
  - `ep:sequence-change` → `{ detail: { id | sequenceId } }`
  - `ep:participation-toggle` → `{ detail: { estimating: boolean } }`
  - `ep:auto-reveal-toggle`, `ep:topic-toggle` (host‑only)
- **Global functions:** `window.revealCards()`, `window.resetRoom()` (thin wrappers).
- **Telemetry:** `window.__epVU` (array of recent WS JSON messages), `window.__epWs` (current WebSocket).

## 18) Guardrails to avoid “helper sprawl”

- Prefer **bridging events and ARIA states** in `room.js` over adding new test helpers.
- Tests act as **specs**; when a test needs a capability, expose a tiny **event or aria‑based signal** instead of extra DOM hooks.
- Keep the public surface stable and documented here; update this file when it changes.

**Last updated:** 2025-10-13
