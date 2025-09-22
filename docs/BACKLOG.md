# Backlog

> Scope: lightweight, dev-facing backlog for estpoker.  
> Conventions: [P1]=high, [P2]=medium, [P3]=low.  
> Status tags: ⏳ planned · ��� in progress · ✅ done

---

## [P3] Configurable JIRA base URL per room  ⏳
**Goal:** Allow the host to set a JIRA base URL per room so plain issue keys (e.g., `ABC-123`) are auto-linked to the correct instance.

**Behavior**
- Paste full JIRA URL → keep current behavior (extract key for display, link to original URL).
- Enter only a key → if a `jiraBaseUrl` exists (e.g., `https://jira.example.com/browse/`), render link `base + KEY`.
- If no base exists → show key as plain text (no link).

**Scope / Persistence**
- Room-scoped, host-only editable.
- Stored in room snapshot (e.g., `StoredRoom.Settings.jiraBaseUrl`).
- Feature-flag-able (defaults off).

**Acceptance**
- Host can set/clear via small settings UI.
- Non-hosts cannot edit.
- Keys link correctly; full URLs still work.
- Survives refresh & persistence.

**Notes**
- Keep **current behavior** (full URL → extract key & display it, link points to full URL) as the default until this ships.

---

## [P2] Optimistic topic editing — polish  ⏳
**Today:** Optimistic local UI after “Save”.  
**Polish**
- Disable “Save” when unchanged.
- Small “saving…” affordance; rollback on server error.
- `Esc` reliably reverts to last persisted value.
- Keep caret position when re-rendering.

**Acceptance**
- No “jump back” while typing.
- Clear feedback on save/rollback.

---

## [P3] Snapshot trigger via domain events  ⏳
Replace manual snapshot hooks with domain events.

**Design**
- Publish `RoomChangedEvent(room, actor)` after mutations.
- `@EventListener` calls debounced `saveFromLive(...)`.
- Optional: `@Aspect` on annotated mutation methods.

**Acceptance**
- Debounce respected; no behavior change vs. manual calls.
- Coverage: votes, topic set/clear, topic visible toggle, allow-specials, auto-reveal, sequence change, join/leave/rename, host change, reset/reveal, kick, close.

---

## [P2] UI for room password flows (host + join)  ⏳
**Server is ready** (`setPassword/verifyPassword` exist).  
**Add UI**
- Host: set/clear password (hashing remains on server).
- Join: prompt & retry handling; error message on mismatch.
- Persist across refresh; no leak in client logs.

**Acceptance**
- Protected rooms block entry until verified.
- Clearing password unlocks immediately for new joins.

---

## [P3] Persistence merge semantics — tests & guardrails  ⏳
- Roundtrip tests for `RoomCodec` (settings + topic label/url + participants).
- Verify merge keeps sensitive fields (e.g., password hash & timestamps).
- Add unit tests mirroring `StoredRoomPersistenceServiceTest` scenarios.

---

## [P2] Test/Build infrastructure hardening  ⏳
- Add Mockito agent to Surefire to stop self-attach warning.
- Remove remaining usages of deprecated `@MockBean` in tests; prefer plain Mockito / slices.
- Add WS handler tests (integration-style) for topic/vote flows.

**Acceptance**
- `mvn test` clean: no Mockito self-attach warning, no deprecations.
- Basic WS happy-path covered by tests.

---

## [P3] FTPS backend reliability  ⏳
- Retries/backoff & clearer error messages.
- Config validation (timeouts, passive/implicit modes).
- Optional storage SPI abstraction to allow SFTP/S3 later.

**Acceptance**
- Write paths tolerate transient network hiccups.
- Logging points at actionable config (host, port, TLS mode).

---

## [P3] Security & rate limits  ⏳
- Throttle high-frequency WS messages (e.g., `topicSave` spam).
- Input length validation (topic label/url).
- Audit log for persistence (who saved what, room code).
- Re-check WebSocket origin allowlist; config docs.

---

## [P3] Accessibility & UX  ⏳
- Keyboard navigation for topic row & action buttons.
- Proper ARIA labels/titles; consistent language (DE/EN).
- Toasts for save success/failure, non-blocking.

---

## [P3] Performance tweaks  ⏳
- Throttle/coalesce `broadcastRoomState` on rapid changes.
- Consider incremental diffs for large rooms.
- Trim payload size where possible.

---

## [P3] Multi-tenant / per-room preferences  ⏳
- Persist per-room preferences like `language` and (future) `jiraBaseUrl`.
- Expose in room settings for host.

---

## [P3] Frontend maintainability  ⏳
- Split `room.js` (~1400 LOC) into modules (state, render, ws, actions).
- Light unit tests for pure helpers (formatting, parsing).

---

## Reference / Done

- ✅ Topic inline editing flicker fix (local echo + revert gate).
- ✅ Debounced snapshot wrapper (config via `features.persistentRooms.snapshot.*`).
- ✅ Stored-room merge preserves password hash (tests green).
- ✅ Unknown-property warnings cleaned up (Spring config metadata / variant B).
- ✅ Room persistence fallback (NoOp) when feature off.

