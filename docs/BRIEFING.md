# EST Poker — Briefing

This document captures the shared baseline for the project, the local working environment, and our collaboration workflow. It’s meant to be stable, concise, and actionable.

---

## 0) Purpose

Lightweight online estimation poker with real-time updates, simple UX, and optional snapshots. Server-rendered HTML + vanilla JS; Spring Boot backend.

**Prod:** https://ep.noxvobiscum.at/

---

## 1) Current Working Environment (Dev box)

Keep this accurate; update when versions change.

- **OS:** Windows (terminal: Git Bash)
- **Editor:** VS Code
- **VCS:** Git (remote origin)
- **Build:** Maven Wrapper (`mvnw`)
- **Runtime:** Java 21 (OpenJDK)
- **Backend:** Spring Boot 3.x, WebSocket (server push), Thymeleaf views
- **Frontend:** vanilla JavaScript; global stylesheet: `src/main/resources/static/styles.css`
- **Tests:** JUnit 5, Mockito; E2E/UI with Playwright (run separately)
- **Deployment:** Koyeb (behind Cloudflare)
- **Persistence:** In-memory live state; **FTPS JSON snapshots** (no database required)
- **Configuration:** `src/main/resources/application.properties` (+ profile files)

### 1.1 Quick commands

- Java: `java -version`
- Maven wrapper: `./mvnw -v`
- Tests (fast loop): `./mvnw -q -DskipITs -DskipE2E test`

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

---

## 3) Configuration & Feature Flags

**Base config:** `application.properties`  
**Per-profile overrides:** `application-local.properties`, `application-prod.properties`

**Key properties (examples)**
- WebSocket allowed origins: `app.websocket.allowed-origins=...`
- FTPS storage (DomainFactory):
  - `app.storage.mode=ftps`
  - `app.storage.ftps.host / port / user / pass / base-dir`
  - `app.storage.ftps.passive / implicit-mode / timeouts / use-utf8 / debug`
- Snapshotter:
  - `features.persistentRooms.snapshot.enabled=true|false`
  - `features.persistentRooms.snapshot.debounceMs=1500`

**Rules**
- Keys must be **spelled exactly**; remove unknown/misspelled keys.
- Do **not** hardcode tenant-specific URLs (e.g., JIRA base).  
  Current UX: paste full JIRA link → we extract the **issue key** for display and keep the **full URL** as the anchor target.  
  A configurable base URL (host-editable) is tracked in the backlog.

---

## 4) Coding & Style Rules

- **English in code**: names, comments, messages.
- **CSS centralization**: all styling in `static/styles.css` (avoid inline styles).
- **Small, focused changes**: avoid bundling refactors with features.
- **Reuse first**: prefer extending existing files over creating new ones.

---

## 5) Collaboration Workflow (Dev ↔ AI)

These rules keep iterations safe, quick, and easy to review.

### 5.1 Kickoff checklist for a new session
- Share the **current repo shape** (no guessing):
  - Windows: `tree /F > tree.txt`
  - Git Bash/WSL: `find . -type f | sort > tree.txt`
- Share **active config** (`application.properties` + active profile file).
- State **what you want to change** (file path + goal) and **constraints**.

### 5.2 Change workflow (small steps)
1) Confirm target file(s) and **exact block(s)**.  
2) Provide a **minimal patch** only for that block.  
3) You run/tests → report back → next small step.

### 5.3 State & assumptions policy
- **No assumptions**. After longer pauses, re-confirm the **as-is** before proposing edits.

### 5.4 Snippet/diff policy
- Drop-in snippets only when the replaceable block is **uniquely identifiable**.
- If not unique, either request exact surroundings or use one-time **BEGIN/END markers**.

### 5.5 Styling policy
- **All styles live in `styles.css`**; reuse existing tokens/classes.

### 5.6 Testing policy
- New logic → new/updated tests.  
- Target: ~90% coverage for core modules (medium-term).
- Fast unit loop: `./mvnw -q -DskipITs -DskipE2E test`

### 5.7 Feature flags
- Behavioral changes behind flags must document:
  - property keys + defaults here in the Briefing, and
  - any migration/ops note needed.

### 5.8 Backlog & docs hygiene
- “Do later” items → `docs/BACKLOG.md`.
- Collaboration rules live here; UI tokens in `STYLE.md` (optional).

### 5.9 Dependencies
- Keep footprint small. Before adding a dep:
  - verify necessity,
  - align with stack,
  - ensure we don’t already have a fitting solution.

---

## 6) Topic UX (frontend notes)

- **Optimistic editing** for hosts: inbound server pushes do not overwrite while the user types.
- **Auto-link handling**: paste a full JIRA URL → UI extracts and shows the issue key while keeping the full URL as the anchor target.
- Real-time updates coalesce/debounce where typing is active.

---

## 7) Profiles & Environments

- **Profiles:** `local`, `prod`
  - `application-local.properties`: local developer defaults (e.g., H2 console for other areas if needed, logs, etc.)
  - `application-prod.properties`: production-safe defaults (forwarded headers, WebSocket origins)
- **Koyeb** runs with profile `prod` and sits behind Cloudflare.

---

## 8) Deploy & Ops (Koyeb)

**Required env vars (FTPS)**
- `DF_FTP_HOST`, `DF_FTP_PORT`, `DF_FTP_USER`, `DF_FTP_PASS`, `DF_FTP_BASE`  
  (These feed `app.storage.ftps.*` via `${...}` placeholders.)

**Health**
- App health endpoint: `GET /healthz` → `ok`
- Spring Actuator is available if needed: `/actuator/health`

**Smoke tests**
- `GET /` → 200 (landing page)
- `GET /healthz` → `ok`

**Logs**
- On boot you should see:  
  `The following 1 profile is active: "prod"`  
  And the WebSocket mapping + allowed origins.

---

## 9) Tooling Notes

- **Mockito inline mock maker warning** is currently benign; if/when JDKs disable dynamic agent loading by default, add the Mockito Java agent as documented upstream.

---

## 10) Accessibility & i18n

- i18n keys live in `messages*.properties`; avoid hardcoded strings where a key exists.
- Icon-only buttons include aria-labels; keep contrast ratios; ensure keyboard navigation works.

---

## 11) How to start the next session (TL;DR)

1) Paste **file tree** (or the relevant excerpt).  
2) Paste **active configs**.  
3) Tell me **which file/block** to change and constraints.  
4) I’ll respond with **one small patch**; you apply/run/tests; we iterate.

---

## 12) Backlog (pointer)

Backlog items are maintained in `docs/BACKLOG.md`. Current examples include:
- Configurable JIRA base URL (host-editable, persisted per room/workspace)
- Menu compactness (font sizes, line heights, spacing tokens in `styles.css`)
- Expand Playwright coverage and CI integration
- Additional accessibility polish (focus states, roles, landmarks)
