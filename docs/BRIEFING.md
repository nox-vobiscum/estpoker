# EST Poker — Briefing

This document captures the shared baseline for the project, the local working environment, and our collaboration workflow. It’s meant to be stable, concise, and actionable.

---

## 0) Purpose (short)

Lightweight online estimation poker with real-time updates, simple UX, and optional persistence (snapshots). Server-rendered HTML + vanilla JS for minimal footprint; Spring Boot backend.

---

## 1) Current Working Environment (Dev box)

> Keep this section accurate. When versions change, update here.

- **OS:** Windows (terminal: Git Bash)
- **Editor:** VS Code
- **VCS:** Git (remote origin)
- **Build:** Maven Wrapper (`mvnw`)
- **Runtime:** Java (OpenJDK)
- **Backend:** Spring Boot 3.x, WebSocket (server push), Thymeleaf views
- **Frontend:** vanilla JavaScript, server-rendered HTML; global stylesheet: `src/main/resources/static/styles.css`
- **Tests:**  
  - Unit/Component: JUnit 5, Mockito  
  - E2E/UI: Playwright (run separately)
- **Deployment:** Koyeb (behind Cloudflare proxy/CDN)
- **Persistence options:** in-memory; FTPS store; optional JPA wiring available
- **Configuration:** `src/main/resources/application.properties` (+ profile-specific overrides)

### 1.1 Quick commands

- Java: `java -version`  
- Maven wrapper: `mvnw -v`  
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
- **Per-profile overrides:** e.g. `application-prod.properties`, `application-prod-h2.properties`

**Examples**
- Persistence master switch:  
  `features.persistentRooms.enabled=false` (No-Op persistence fallback still wired so the app boots)
- Snapshot debouncer (only if used in this profile):  
  - `features.persistentRooms.snapshot.enabled=true|false`  
  - `features.persistentRooms.snapshot.debounceMs=1500`

**Rules**
- Keys must be **spelled exactly**; remove unknown/misspelled keys.
- Keep sensible defaults; production overrides via env/profiles.
- Do **not** hardcode tenant-specific URLs (e.g., JIRA base). Current UX accepts full JIRA links and extracts the issue key for display while preserving the full URL as the anchor target. A configurable base URL is tracked in the backlog.

---

## 4) Coding & Style Rules

- **English everywhere in code:** class names, method names, variables, inline comments, messages.  
  - Do **not** add any “English inline comment:” prefixes.
- **Frontend styling:** all CSS centralized in `static/styles.css`.  
  - Avoid inline styles; consolidate into `styles.css` when possible.
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
1) Confirm target file(s) and **exact block(s)**.  
2) Provide a **minimal patch/snippet** only for that block.  
3) You run/tests → report back → next small step.  

No batching of unrelated edits. Prefer one change per step/commit.

### 5.3 State & assumptions policy
- **No assumptions.** If current code may differ from memory, we first ask for the **actual “as-is”** (file tree, file content, or relevant fragment).
- After longer pauses, we explicitly **re-confirm** current state before proposing edits.

### 5.4 Snippet & diff policy
- Drop-in snippets only when the replaceable block is **uniquely identifiable**.
- If not unique, either:
  - request the exact surrounding lines, or
  - add one-time **BEGIN/END markers** to ease future patches:
    ```java
    // BEGIN topic-row:render
    ... block ...
    // END topic-row:render
    ```

### 5.5 Reuse before creating new files
- Check whether existing structures can host the change.
- New files/folders/dependencies only when clearly beneficial.

### 5.6 Styling policy
- **All styles live in `styles.css`.**  
- Reuse existing tokens/classes; if adding a token, define it in `styles.css` and reference it.

### 5.7 Testing policy
- New logic → new/updated tests. Target: **~90% coverage** for core modules.  
- Fast unit loop: mvnw -q -DskipITs -DskipE2E test


### 5.8 Config & feature flags
- Behavioral changes behind flags must include:  
- the property keys + defaults, and  
- an entry in **this** BRIEFING when introducing new flags.

### 5.9 Backlog & docs hygiene
- “Do later” items go to `docs/BACKLOG.md`.  
- Rules and conventions live here (`BRIEFING.md`) and, for UI rules, in `STYLE.md` (optional helper doc).  
- New collaboration rules agreed during chats are **added here** as part of the same step.

### 5.10 Dependencies
- Keep the footprint small. Before adding a dependency:
- verify necessity,
- check alignment with the stack,
- ensure no existing solution already fits.

---

## 6) Testing

- **Unit/Component:** JUnit 5 + Mockito.  
- **E2E/UI:** Playwright (separate run; not part of Surefire default).  
- **Goal:** expand test automation continuously; aim for ~90% coverage on core services and domain model.

Command (fast loop): mvnw -q -DskipITs -DskipE2E test


---

## 7) Persistence & Snapshotting (summary)

- Live mutations happen in memory (`Room` / `Participant`).
- A debounced snapshotter can call `RoomPersistenceService.saveFromLive(room, actor)` to keep a persistent mirror (when enabled).
- If `features.persistentRooms.enabled=false`, a **No-Op** implementation is wired so the app still boots.
- Integration points are **opt-in** and cheap (best effort, non-blocking).

---

## 8) Deploy & Ops (short)

- **Deploy target:** Koyeb  
- **Proxy/CDN:** Cloudflare (forwarded headers via `server.forward-headers-strategy=framework`)  
- **Profiles:** e.g., `prod`, `prod-h2`, `prod-neon`, `local`  
- **Logs:** prefer structured and concise; avoid noisy stack traces for expected flows.

---

## 9) Security & Privacy (short list)

- Avoid leaking secrets in logs.  
- Passwords: BCrypt + optional pepper (see properties).  
- Validate/encode user-provided content (topic label/URL sanitized on render).  
- Do not pin tenant-specific URLs in code (e.g., JIRA base). Accept full links as input; configurable base URL is a backlog item.

---

## 10) Frontend Notes & Topic UX

- **Server-rendered HTML**, vanilla JS. No SPA framework.  
- Real-time updates come from server pushes; client code applies state.  
- **Topic input UX**:
  - **Optimistic editing** for hosts (local input is not overwritten mid-typing by async updates).
  - If a **full JIRA link** is pasted, the UI **extracts and displays the issue key** while keeping the **full URL** as the anchor target.
- **Compact menu/typography** adjustments are centralized in `styles.css` (see backlog tasks for further tuning).

---

## 11) How to start the next session (TL;DR)

1) Paste **file tree** (or relevant excerpt).  
2) Paste **active `application.properties`** (+ current profile file, if used).  
3) Tell me **which file/block** you want to change.  
4) Mention **constraints** (no new deps, styling rules, etc.).  
5) I’ll respond with **one small patch**; you apply/run/tests; we iterate.

---

## 12) Known Warnings & Tooling Notes

- **Mockito inline mock maker / agent**: JDKs will restrict dynamic agent loading in future. For now the warning is benign. If/when needed, add the Mockito Java agent per Mockito docs in your build/test config.
- **Deprecated Spring test annotations** (e.g., `@MockBean` deprecation in recent Spring versions): track upgrade notes, prefer modern test slices and Mockito DI where possible. Keep tests green; migrate pragmatically.

---

## 13) WebSocket/Realtime Policy

- **Stability first**: client code should debounce/coalesce server pushes when user is actively editing.
- **Reconnect/backoff**: client should handle reconnects with exponential backoff; server should treat reconnects idempotently.
- **No mid-typing overwrite**: optimistic UI protects active inputs; inbound state updates are applied after edit ends.

---

## 14) Accessibility & i18n

- **i18n**: messages in `messages*.properties`; avoid hardcoded strings in templates/JS where a key exists.  
- **A11y**: keep buttons/links keyboard-accessible; aria labels for icon-only buttons; maintain contrast ratios.

---

## 15) Backlog (pointer)

Backlog items are maintained in `docs/BACKLOG.md`. Current examples include:
- Configurable JIRA base URL (host-editable, persisted per room/workspace).  
- Snapshot trigger wiring (hook/Decorator around live mutations).  
- Menu compactness (font sizes, line heights, spacing tokens in `styles.css`).  
- Expand Playwright coverage and CI integration.  
- Additional accessibility polish (focus states, roles, landmarks).

---

