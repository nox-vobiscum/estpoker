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

## Next steps — approved post-redesign change requests

The detailed scope, mandatory start gate and acceptance criteria are maintained
in [PLANNING-POKER-CHANGE-REQUESTS.md](PLANNING-POKER-CHANGE-REQUESTS.md).
Execute one request at a time in this order:

1. **CR-001 — Improve estimation topic visibility** (`TODO`)
   - Present the active topic as a dedicated compact panel while preserving the
     existing data, permissions, editing, events and persistence behavior.
   - The known empty-topic editor issue is included in CR-001 validation.
2. **CR-002 — Replace room information panels with collapsible manual** (`TODO`)
   - Replace the room-only informational cards with one accessible guide that is
     collapsed by default.
3. **CR-003 — Improve room exit discoverability** (`TODO`)
   - Expose the existing individual leave action more clearly while preserving
     host-only close-room behavior and all lifecycle contracts.

Documentation consolidation follows CR-001 through CR-003.

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
