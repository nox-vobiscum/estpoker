# Backlog

This backlog collects future improvements and nice-to-haves. Priorities are indicative:
- **P1** high – near-term value / risk
- **P2** medium – useful, not urgent
- **P3** low – nice to have / polish

Status tags:
- ✅ Done
- 🚧 In progress
- ⏳ Planned
- 💤 Parked

---

## [P2] Debounced room snapshotter & unified mutation hooks ⏳
**Goal:** Persist a debounced snapshot of the live room state on relevant mutations (topic, votes, join/leave/rename, settings), avoiding excessive writes.

**Scope**
- Introduce a small `RoomSnapshotter` that wraps `saveFromLive(...)` with `debounceMs` (configurable).
- Single call site per mutation: `snapshotter.onChange(room, actor)`.
- Wire calls in `GameService` after: `setVote`, `saveTopic`, `clearTopic`, `setTopicEnabled`, `setSequence`, `setAutoRevealEnabled`, `setAllowSpecials`, `join`, `renameParticipant`, `kickParticipant`.
- Config via `application.properties`:
  - `features.persistentRooms.enabled=true|false`
  - `features.persistentRooms.snapshot.enabled=true|false`
  - `features.persistentRooms.snapshot.debounceMs=1500`

**Acceptance**
- When multiple mutations occur in rapid succession, at most one persisted snapshot per debounce window.
- Turning snapshot feature off results in zero persistence calls.
- No user-visible latency/regressions.

---

## [P3] JIRA base URL setting (per room, host-editable) ⏳
**Goal:** Allow hosts to set a room-local JIRA base URL (e.g. `https://yourcompany.atlassian.net/browse/`), used to auto-link issue keys entered as plain text.

**Scope**
- Room setting `jiraBaseUrl: string | null` (persisted with room).
- Host-only UI affordance (small “link” icon or “⋯” menu → “Set JIRA base URL…”).
- Safe parsing/normalization (ensure trailing slash).
- When user enters a **full** JIRA link: keep current behavior (extract key, display key, link to full URL).
- When user enters **just a key**: if `jiraBaseUrl` exists → link to `<base><KEY>`; otherwise display plain key.

**Acceptance**
- No global instance config required; each room can differ.
- Works with arbitrary JIRA instances (cloud/on-prem).
- Respects permissions (only host can change base URL).

---

## [P3] Compact navigation & menu density ⏳
**Goal:** Make header/menus and dialogs more compact to show more room content on small screens.

**Scope**
- Reduce default font size and line-height for navigation and controls.
- Tighter paddings/margins in the top bar and menus.
- Validate DE/EN labels for wrapping/overflow.

**Acceptance**
- No overlaps/wrap glitches at ≤360 px width.
- Click targets remain ≥36×36 px.
- No regressions in `room.html`.

---

## [P3] Typography & spacing tokens (CSS variables) ⏳
**Goal:** Centralize typography and spacing via CSS variables to make the UI consistent and easy to tune.

**Scope**
- Define tokens in `:root` (e.g. `--font-size-sm/md/lg`, `--lh-tight/normal`, `--space-1..4`).
- Migrate key components (Topbar, topic row, participant list) to tokens.
- Document tokens and usage in `docs/STYLE.md`.

**Acceptance**
- A single token change scales the UI consistently.
- No visual deviations between DE/EN locales.

---

## [P3] Optional “compact mode” toggle (room setting) ⏳
**Goal:** Toggle a denser layout per room, controlled by the host.

**Scope**
- Room setting `compactMode: boolean` (persisted).
- Add body class `compact` to switch to tighter tokens.
- Host UI toggle (e.g., checkbox in a settings menu).

**Acceptance**
- Toggle takes effect live and persists across reloads.
- Non-hosts see the chosen mode; only hosts can change it.

---

## [P3] Security probe endpoints (opt-in, dev-only) ⏳
**Goal:** Provide optional hashing/diagnostic endpoints behind a feature flag for local/testing only.

**Scope**
- Protected endpoints (e.g., `/diag/security/hash`) enabled only with a dedicated flag and non-prod profile.
- Rate-limited, no secrets in logs.
- Clear documentation/warnings.

**Acceptance**
- Never enabled in `prod` without explicit flag.
- Useful timing/hash diagnostics for developers.

---

## Parking lot / Ideas
- Multi-tracker link patterns (JIRA + others) using a pluggable regex map per room (low priority).
- Visual diff/“last change by …” badges for topic changes (host-only preview).
