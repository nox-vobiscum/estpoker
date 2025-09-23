# EST Poker — BRIEFING

This document captures the shared baseline for the project, the local working environment, our collaboration workflow, and the testing strategy. It’s meant to be stable, concise, and actionable.

---

## 0) Purpose (short)

Lightweight online estimation poker with real-time updates, simple UX, and optional persistence (snapshots). Server-rendered HTML + vanilla JS for minimal footprint; Spring Boot backend.

**Prod URL**  
https://ep.noxvobiscum.at/

---

## 1) Current Working Environment (Dev box)

> Keep this section accurate. When versions change, update here.

- **OS:** Windows (terminal: Git Bash)  
- **Editor:** VS Code  
- **VCS:** Git (remote origin)  
- **Build:** Maven Wrapper (`mvnw`)  
- **Runtime:** Java 21 (OpenJDK)  
- **Backend:** Spring Boot 3.x, WebSocket (server push), Thymeleaf views  
- **Frontend:** vanilla JavaScript, server-rendered HTML; global stylesheet: `src/main/resources/static/styles.css`  
- **Tests:**  
  - Unit/Component: JUnit 5, Mockito  
  - E2E/UI: Playwright (run separately)  
- **Deployment:** Koyeb (behind Cloudflare proxy/CDN)  
- **Persistence options:** in-memory; FTPS file store (JSON); DB/JPA currently **not used**  
- **Configuration:** `src/main/resources/application.properties` (+ optional profile overrides)

### 1.1 Quick commands

- Java: `java -version`  
- Maven wrapper: `./mvnw -v`  
- Node/Playwright (if needed): `node -v`, `npm -v`, `npx playwright --version`

---

## 2) Tech Stack (overview)

- **Language:** Java (backend), HTML/CSS/JS (frontend)  
- **Frameworks:** Spring Boot, Thymeleaf  
- **Realtime:** Spring WebSocket → client JS  
- **Testing:** JUnit 5, Mockito, Playwright (E2E)  
- **Build:** Maven (Surefire for unit tests)  
- **Static assets:** `src/main/resources/static/**`  
- **Templates:** `src/main/resources/templates/**`  
- **Config files:** `src/main/resources/application*.properties`  
- **Feature flags:** `features.*` keys (see §3)

---

## 3) Configuration & Feature Flags

- **Base config:** `application.properties`  
- **Profiles:** currently minimal; prod runs with app defaults (DB off); local profile available for H2 if ever needed for local experiments.  
- **Persistence master switch:**  
  `features.persistentRooms.enabled=false` (No-Op persistence; **current default**)  
- **Snapshot debouncer:**  
  - `features.persistentRooms.snapshot.enabled=true|false`  
  - `features.persistentRooms.snapshot.debounceMs=1500`

**Rules**

- Keys must be **spelled exactly**; remove unknown/misspelled keys.  
- Keep sensible defaults; production overrides via env/profiles.  
- Do **not** hardcode tenant-specific URLs (e.g., JIRA base). Current UX accepts full JIRA links and extracts the issue key for display while preserving the full URL as the anchor target. A configurable base URL is tracked in the backlog.

---

## 4) Coding & Style Rules

- **English everywhere in code:** class names, method names, variables, inline comments, messages.  
- **Frontend styling:** all CSS centralized in `static/styles.css`. Avoid inline styles; consolidate into `styles.css`.  
- **Small, focused changes:** avoid mixing refactors with feature work.  
- **Reuse first:** prefer extending existing files over creating new ones.

---

## 5) Collaboration Workflow (Dev ↔ AI)

These rules keep iterations safe, quick, and easy to review.

### 5.1 Kickoff checklist for every new chat/session
- Share the **current repo shape** to prevent guessing:  
  - Windows: `tree /F > tree.txt`  
  - Git Bash/WSL: `find . -type f | sort > tree.txt`  
  Attach/paste the relevant sections.
- Share **active config** (`application.properties` + the active profile file, if any).  
- State **what you want to change** (file path + goal).  
- State **constraints** (no new deps, CSS centralization, etc.).

### 5.2 Change workflow = small, reviewable steps
1. Confirm target file(s) and **exact block(s)**.  
2. Provide a **minimal patch/snippet** only for that block.  
3. You run/tests → report back → next small step.  

_No batching of unrelated edits. Prefer one change per step/commit._

### 5.3 State & assumptions policy
- **No assumptions.** If current code may differ from memory, we first ask for the **actual “as-is”** (file tree, file content, or relevant fragment).  
- After longer pauses, we explicitly **re-confirm** current state before proposing edits.

### 5.4 Snippet & diff policy
- Drop-in snippets only when the replaceable block is **uniquely identifiable**.  
- If not unique, either request the exact surrounding lines, or add one-time **BEGIN/END markers** to ease future patches.

### 5.5 Reuse before creating new files
- Check whether existing structures can host the change.  
- New files/folders/dependencies only when clearly beneficial.

### 5.6 Styling policy
- **All styles live in `styles.css`.**  
- Reuse existing tokens/classes; if adding a token, define it in `styles.css` and reference it.

### 5.7 Testing policy
- New logic → new/updated tests. Target: **~90% coverage** for core modules.  
- Fast unit loop: `./mvnw -q -DskipITs -DskipE2E test`

### 5.8 Config & feature flags
- Behavioral changes behind flags must include:  
  the property keys + defaults **and** an entry in **this** BRIEFING when introducing new flags.

### 5.9 Backlog & docs hygiene
- “Do later” items go to `docs/BACKLOG.md`.  
- Rules and conventions live here (`BRIEFING.md`) and, for UI rules, optionally `STYLE.md`.  
- New collaboration rules agreed during chats are **added here** as part of the same step.

### 5.10 Dependencies
- Keep the footprint small. Before adding a dependency: verify necessity, check alignment with the stack, and ensure no existing solution already fits.

---

## 6) Testing (expanded)

Testing spans three layers: **unit/component**, **web/controller**, and **E2E (Playwright)**.

### 6.1 Unit/Component (JUnit 5, Mockito)
- Scope: domain logic and services (e.g., `Room`, `StoredRoom`, `StoredRoomPersistenceService`).  
- Command (fast loop):  
  `./mvnw -q -DskipITs -DskipE2E test`  
- Tips:  
  - Prefer pure unit tests without Spring context.  
  - Use constructor injection in prod code to make mocking easy.  
  - Keep assertions focused and deterministic.

### 6.2 Web/Controller tests
- When needed, test MVC endpoints with Spring’s MockMvc slices.  
- Keep these **small** and **stateless**; avoid DBs (we don’t use DB in prod).

### 6.3 E2E/UI (Playwright)
Goal: verify core user flows end‑to‑end in a real browser.

**Prereqs**
- Node.js LTS installed.  
- In the repo root (or `tests/e2e` if you keep them there):
  ```bash
  npm i -D @playwright/test
  npx playwright install
  ```

**Config (example `playwright.config.ts`)**
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true
  },
});
```

**Running locally**
```bash
# App running locally on :8080
npx playwright test
# or override base URL explicitly
BASE_URL=http://localhost:8080 npx playwright test
```

**Test structure (examples)**
- `e2e/landing.spec.ts` — loads `/`, basic smoke (title, join form visible)  
- `e2e/invite.spec.ts` — deep link to `/invite?roomCode=...` shows prefilled code  
- `e2e/room.spec.ts` — join flow → room loads → vote → reveal → average shown  
- `e2e/topic.spec.ts` — host edits topic; optimistic input; JIRA link auto-extraction

**Selector strategy**
- Prefer **roles/labels** for stability: `getByRole('button', { name: /save/i })`, `getByLabel('Name')`.  
- Add `data-testid` **sparingly** for hard-to-reach elements; keep names stable.  
- Avoid brittle CSS/xpath selectors.

**CI/Artifacts**
- Keep Playwright artifacts on failures (trace, screenshot, video).  
- Document the CI command here when added (same `BASE_URL` approach).

**Done criteria**
- Tests run reliably against `http://localhost:8080`.  
- Core flows covered (join room, vote, reveal, topic edit).  
- Failure artifacts are useful for debugging (trace viewer).

---

## 7) Persistence & Snapshotting (summary)

- Live mutations happen in memory (`Room` / `Participant`).  
- A debounced snapshotter can call `RoomPersistenceService.saveFromLive(room, actor)` to keep a persistent mirror (when enabled).  
- With `features.persistentRooms.enabled=false`, a **No‑Op** implementation is wired so the app still boots.  
- FTPS JSON storage is the current persistence choice for saved rooms; DB/JPA code has been retired from runtime.

---

## 8) Deploy & Ops (short)

- **Deploy target:** Koyeb  
- **Proxy/CDN:** Cloudflare (`server.forward-headers-strategy=framework`)  
- **Health:** `GET /healthz` returns `ok`  
- **Profiles:** minimal; prod uses defaults; DB/JPA disabled  
- **Logs:** concise; avoid noisy stack traces for expected flows

---

## 9) Security & Privacy (short list)

- Avoid leaking secrets in logs.  
- Passwords: BCrypt + optional pepper (see properties).  
- Validate/encode user-provided content (topic label/URL sanitized on render).  
- Do not pin tenant-specific URLs in code (e.g., JIRA base). Accept full links as input; configurable base URL is a backlog item.

---

## 10) Frontend Notes & Topic UX

- **Server-rendered HTML**, vanilla JS (no SPA).  
- Realtime via WebSocket; client applies state updates.  
- **Topic input UX**:  
  - **Optimistic editing** for hosts (local input isn’t overwritten mid‑typing by async updates).  
  - If a **full JIRA link** is pasted, the UI **extracts and displays the issue key** while keeping the **full URL** as the anchor target.  

- Compact menu/typography adjustments live in `styles.css` (see backlog for further tuning).

---

## 11) How to start the next session (TL;DR)

1) Paste **file tree** (or relevant excerpt).  
2) Paste **active `application.properties`** (+ current profile file, if used).  
3) Tell me **which file/block** you want to change.  
4) Mention **constraints** (no new deps, styling rules, etc.).  
5) I’ll respond with **one small patch**; you apply/run/tests; we iterate.

---

## 12) Known warnings & tooling notes

- **Mockito inline mock maker / agent**: JDKs may restrict dynamic agent loading in future. The warning is benign today. If needed later, add the Mockito Java agent per Mockito docs in test config.  
- Keep Spring test slices modern; favor Mockito/injection over heavyweight contexts.

---

## 13) WebSocket/Realtime policy

- **Stability first**: debounce/coalesce server pushes when user is actively editing.  
- **Reconnect/backoff**: client handles reconnects with exponential backoff; server treats reconnects idempotently.  
- **No mid‑typing overwrite**: optimistic UI protects active inputs; inbound state updates apply after edit ends.

---

## 14) Accessibility & i18n

- **i18n**: messages in `messages*.properties`; avoid hardcoded strings in templates/JS where a key exists.  
- **A11y**: icon buttons get aria‑labels; keyboard access maintained; contrast respected.

---

## 15) Backlog (pointer)

Backlog items are maintained in `docs/BACKLOG.md`. Current examples include:  
- Configurable JIRA base URL (host-editable, persisted per room/workspace).  
- Snapshot trigger wiring (hook/decorator around live mutations).  
- Menu compactness (font sizes, line heights, spacing tokens in `styles.css`).  
- Expand Playwright coverage and wire a simple CI job.  
- Additional accessibility polish (focus states, roles, landmarks).



## ###########################################
## ##########+++++ Appendices +++++###########
## ###########################################

## Appendix A — Public surface (routes & sockets)

- `GET /` → Landing page  
- `GET /invite?roomCode=...` → Invite page (pre-fills hidden room field)  
- `POST /join` → Validates inputs, decides persistent/non-persistent, redirects to `/room`  
- `GET /room?roomCode=...&participantName=...` → Main room view  
- `GET /api/rooms/check?name=...` → Returns `true` if the name is already taken (when feature backed)  
- `GET /healthz` → Plain health probe (returns `ok`)  
- **WebSocket:** `/gameSocket` (origins controlled via `app.websocket.allowed-origins`)

---

## Appendix B — FTPS env reference (current persistence mode)

| Property key                         | Env fallback (if any) | Default | Notes |
|-------------------------------------|------------------------|---------|------|
| `app.storage.mode`                   | —                      | `ftps`  | Current mode selector |
| `app.storage.ftps.host`             | `DF_FTP_HOST`          | —       | FTPS host |
| `app.storage.ftps.port`             | `DF_FTP_PORT`          | `21`    | Port |
| `app.storage.ftps.user`             | `DF_FTP_USER`          | —       | Username |
| `app.storage.ftps.pass`             | `DF_FTP_PASS`          | —       | Password |
| `app.storage.ftps.base-dir`         | `DF_FTP_BASE`          | `rooms` | Root dir for JSON snapshots |
| `app.storage.ftps.passive`          | —                      | `true`  | Passive mode recommended |
| `app.storage.ftps.implicit-mode`    | —                      | `false` | Explicit FTPS by default |
| `app.storage.ftps.so-timeout-ms`    | —                      | `15000` | Control/data timeouts |
| `app.storage.ftps.data-timeout-ms`  | —                      | `20000` | 〃 |
| `app.storage.ftps.use-utf8`         | —                      | `true`  | Filenames/paths |
| `app.storage.ftps.debug`            | —                      | `true`  | Verbose logs (disable in prod if noisy) |

> Password hashing: `app.security.password.bcrypt-cost` (default 10), optional `app.security.password.pepper`.

---

## Appendix C — Concurrency guardrails (Room model)

- `Room` holds in-memory state; mutations happen on server.  
- List is a `CopyOnWriteArrayList`, but **external code should still synchronize on the Room** when performing multi-step mutations to keep snapshots consistent.  
- Use provided methods (`addParticipant`, `removeParticipant`, `renameParticipant`, `reset`, …). Don’t expose or mutate internal collections directly.

---

## Appendix D — Quick test commands

- All unit tests:  
  ./mvnw -q -DskipITs -DskipE2E test

- Single test class:
  ./mvnw -q -DskipITs -DskipE2E -Dtest=StoredRoomPersistenceServiceTest test

- With logs (noisy, for debugging):
  ./mvnw test -X

---

## Appendix E — Playwright (next steps)

Goal: restore green E2E smoke against local http://localhost:8080.

Plan (tracked in BACKLOG):
- Minimal playwright.config.ts with BASE_URL (inherit via env).
- One smoke spec: open /, join a room, see your name, basic vote, reveal.
- Keep selectors aligned with the UI: prefer roles/labels; add data-testid only where ARIA/roles are unstable.
- Capture trace/screenshot on failure.
- Command sketch (once added):
    npx playwright test --headed
    # or
    BASE_URL=http://localhost:8080 npx playwright test

