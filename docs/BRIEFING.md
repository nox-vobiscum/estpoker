# EST Poker — BRIEFING

This document captures the stable baseline for the project, the local working environment, and how we collaborate. It’s the single source of truth we both reference in new chats.

---

## 0) Purpose (short)
Lightweight online *Estimation Poker* with real‑time updates, clean UX, and optional persistence via simple snapshots. Server‑rendered HTML + vanilla JS; Spring Boot backend.

**Prod URL:** https://ep.noxvobiscum.at/

---

## 1) Current Working Environment (Dev box)
> Keep this accurate. When versions change, update here.

- **OS:** Windows (terminal: Git Bash)
- **Editor:** VS Code
- **VCS:** Git (GitHub remote)
- **Build:** Maven Wrapper (`mvnw`)
- **Runtime:** Java 21 (OpenJDK)
- **Backend:** Spring Boot 3.x, WebSocket (server push), Thymeleaf views
- **Frontend:** Vanilla JavaScript; server-rendered HTML; **global CSS:** `src/main/resources/static/styles.css`
- **Tests:**  
  - Unit/Component: JUnit 5, Mockito  
  - E2E/UI: Playwright (run separately)
- **Deployment:** Koyeb (behind Cloudflare)
- **Persistence options:** In‑memory baseline. JSON snapshots over FTPS (current prod). JPA wiring removed/disabled by default.
- **Configuration:** `src/main/resources/application.properties` (+ optional per‑profile overrides)

### 1.1 Quick commands
- Java: `java -version`  
- Maven wrapper: `mvnw -v`  
- Node/Playwright: `node -v`, `npm -v`, `npx playwright --version`

---

## 2) Tech Stack (overview)
- **Languages:** Java (backend), HTML/CSS/JS (frontend)
- **Frameworks:** Spring Boot, Thymeleaf, Spring WebSocket
- **Testing:** JUnit 5, Mockito, Playwright (E2E)
- **Build:** Maven (Surefire for unit tests)
- **Static assets:** `src/main/resources/static/**`
- **Templates:** `src/main/resources/templates/**`
- **Config files:** `src/main/resources/application*.properties`
- **Feature flags:** `features.*` (see §3)

---

## 3) Configuration & Feature Flags
- **Base config:** `application.properties`
- **Profiles:** `prod`, `local` (use env var `SPRING_PROFILES_ACTIVE` when needed)

**Relevant flags**
- `features.persistentRooms.enabled=false` → No DB/JPA wiring (default).  
- Snapshot debouncer (if active in the profile):
  - `features.persistentRooms.snapshot.enabled=true|false`
  - `features.persistentRooms.snapshot.debounceMs=1500`

**Rules**
- Keys must be spelled **exactly**; remove unknown/misspelled keys.
- Keep sensible defaults; production overrides via env/profiles.
- Do **not** hardcode tenant‑specific URLs (e.g., JIRA base). Current UX: paste full JIRA links; UI extracts the issue key for display while keeping the full URL as the anchor target. A configurable JIRA base is tracked in the backlog.

---

## 4) Coding & Style Rules
- **English naming & comments** across the codebase.
- **Centralized styling:** all CSS lives in `static/styles.css`. Avoid inline styles.
- **Small, focused changes:** avoid mixing refactors with feature work.
- **Reuse first:** prefer extending existing files over creating new files/folders/dependencies.

---

## 5) Collaboration Workflow (Dev ↔ AI)

### 5.1 Kickoff checklist (every new chat/session)
- Share the **current repo shape** (to avoid guesses):  
  - Windows: `tree /F > tree.txt`  
  - Git Bash/WSL: `find . -type f | sort > tree.txt`  
  Paste/attach the relevant parts.
- Share **active config** (`application.properties` + active profile override, if any).
- State the **target** (file path + goal) and **constraints** (no new deps, CSS rules, etc.).

### 5.2 Change workflow = small, reviewable steps
1) Confirm target file(s) and **exact block(s)**.  
2) Provide a **minimal patch/snippet** only for that block.  
3) You run/tests → report back → next small step.

No batching of unrelated edits. Prefer one change per step/commit.

### 5.3 State & assumptions policy
- **No assumptions.** If current code may differ from memory, we first fetch the **actual as‑is** (file or fragment).
- After longer pauses, explicitly **re‑confirm** current state before proposing edits.

### 5.4 Snippet & diff policy
- Drop‑in snippets only when the replaceable block is **uniquely identifiable**.
- If not unique, either request the exact surrounding lines, or add one‑time **BEGIN/END markers** to ease future patches:
  ```java
  // BEGIN topic-row:render
  …block…
  // END topic-row:render
  ```

### 5.5 Reuse before creating new files
- Check whether existing structures can host the change.
- New files/folders/dependencies only when clearly beneficial.

### 5.6 Styling policy
- **All styles live in `styles.css`.**
- Reuse existing tokens/classes; if adding tokens, define them in `styles.css` and reference them.

### 5.7 Testing policy
- New logic → new/updated tests. Target: **~90% coverage** on core modules.  
- Fast unit loop: `mvnw -q -DskipITs -DskipE2E test`

### 5.8 Config & feature flags
- Behavioral changes behind flags must ship with:
  - property keys & defaults, and
  - an entry in **this** BRIEFING when introducing new flags.

### 5.9 Backlog & docs hygiene
- “Do later” items go to `docs/BACKLOG.md`.
- Collaboration rules live here (`BRIEFING.md`). If we agree new rules during chats, we **add them here** immediately.

### 5.10 Dependencies
- Keep the footprint small. Before adding a dependency:
  - verify necessity,
  - check alignment with the stack,
  - ensure no existing solution already fits.

---

## 6) Testing Strategy

### 6.1 Unit/Component (JUnit 5 + Mockito)
- Run: `mvnw -q -DskipITs -DskipE2E test`
- Keep tests deterministic and fast; prefer constructor injection and plain Java over heavy Spring slices unless needed.

### 6.2 E2E/UI (Playwright — to be expanded)
- **Goal:** reliable smoke/regression coverage of the core flows (create/join room, vote, reveal, topic edit).
- **Recommended shape:**
  - `playwright.config.ts` with `BASE_URL` override
  - selectors prefer roles/labels; `data-testid` only if necessary
  - artifacts (trace/screenshots/video) on failures
- **Done criteria:** tests run reliably locally against `http://localhost:8080`, CI‑ready command documented here, failures produce useful artifacts (trace viewer).

> We will add concrete scripts/config back once we re‑enable full Playwright runs. This section is the agreed north star.

---

## 7) Persistence & Snapshotting (summary)
- Live mutations happen in memory (`Room` / `Participant`).
- Debounced snapshotter can call `RoomPersistenceService.saveFromLive(room, actor)` when enabled.
- Current prod: JSON snapshots over FTPS (no DB/JPA). Wiring to DB was removed.

---

## 8) Deploy & Ops (short)
- **Target:** Koyeb
- **Proxy/CDN:** Cloudflare (forward headers via `server.forward-headers-strategy=framework`)
- **Profiles:** `prod`, `local`
- **Health:** lightweight health at `/healthz`
- **Logs:** concise; avoid noisy stack traces for expected flows

---

## 9) Security & Privacy (short)
- Don’t leak secrets in logs.
- Passwords: BCrypt + optional pepper (see properties).
- Validate/encode user‑provided content; topic label/URL sanitized on render.
- No tenant‑specific URLs pinned in code (JIRA base is configurable later; full links are accepted today).

---

## 10) Realtime Policy (WebSocket)
- **Stability first:** debounce/coalesce inbound updates while user is actively editing.
- **Reconnect/backoff:** client handles reconnects; server treats reconnects idempotently.
- **No mid‑typing overwrite:** optimistic UI protects active inputs; inbound state is applied after edit ends.

---

## 11) Frontend Notes & Topic UX
- Server‑rendered HTML, vanilla JS; no SPA framework.
- Real‑time updates are pushed by the server; client applies state.
- **Topic field:**
  - Hosts get **optimistic editing** (local input is not overwritten mid‑typing).
  - Pasting a **full JIRA link** auto‑extracts the **issue key** for display while preserving the full URL as the anchor target.
- Compact menu/typography lives in `styles.css` (further tuning in backlog).

---

## 12) How to start the next session (TL;DR)
1) Paste **file tree** (or relevant excerpt).  
2) Paste **active `application.properties`** (+ current profile file, if used).  
3) Tell me **which file/block** you want to change.  
4) Mention **constraints** (no new deps, styling rules, etc.).  
5) I’ll respond with **one small patch**; you apply/run/tests; we iterate.

---

## 13) Backlog pointer
Backlog items are maintained in `docs/BACKLOG.md`. Examples:
- Configurable JIRA base URL (host‑editable, persisted per room/workspace).
- Menu compactness (font sizes, line heights, spacing tokens in `styles.css`).
- Expand Playwright coverage and CI integration.
- Additional accessibility polish (focus states, roles, landmarks).
