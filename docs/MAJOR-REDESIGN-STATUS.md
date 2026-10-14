# Major Redesign Status

- Updated: 2026-10-14.
- Branch: feature/major-redesign.
- Last completed work: MR-020 public-page Analytics and MR-021 bilingual imprint (DONE), following MR-018.
- Current story: None. Google Analytics is limited to public content pages; room/invite URLs remain tracking-free. `/imprint` includes the approved public contact details, shared navigation and contextual room return.
- Implementation: Accessible main landmarks, special-card labels, sequence semantics and card selection state; preserved card focus after full grid rebuild; localized persistent result announcements; readable inactive preferences, public links and muted text; reduced-motion support for result and interaction effects.
- Frozen contracts: Game, WebSocket protocol, backend, permissions, CID, persistence and preference/menu owners remain unchanged.
- Tests: MR-018 Maven verify passed 30 tests; npm ci:verify passed. All 195 distinct Playwright tests have passing evidence across three shards plus targeted corrections, with zero automatic retries/skips. One false order assertion and one missing persistence assertion were corrected in tests only; application code unchanged.
- Audit evidence: Corresponding Chromium/Firefox controls differed by less than 2px and shared radii and normalized appearance. Pairwise screenshot inspection found only expected glyph rasterization and minor text-wrap differences, with no material geometry or clipping issue.
- Interrupted-work reconciliation: Shard 3 completed during the usage-limit interruption (64/64). On resume its report was verified, the pending TypeScript tuple correction applied, both changed tests checked and the final guards rerun successfully. No MR-018 validation step remains outstanding.
- Remaining limits: Safari/WebKit is outside MR-017's Chromium/Firefox scope. Manual NVDA/VoiceOver review, the known topic-editor defect and stale-room-return limitation remain unchanged.
- Local preview: Final MR-016 build is running at http://localhost:8080 with persistent room snapshots disabled.
- Delivery: MR-020 and MR-021 use separate commits on the feature branch; no push or production deployment.
- STOP: MR-021 complete. Do not begin another story automatically.

## Return-to-room visual polish — 2026-10-14

- Completed the separately requested visual adjustment after the usage-limit interruption; no further story started.
- Shared return fragment now uses a decorative left arrow and an emphasized room name without quotation marks. Existing translations, link IDs, destination and navigation JavaScript are unchanged.
- Shared CSS uses existing theme/style tokens, a 40px minimum height, subtle hover treatment and the existing keyboard focus outline. Underlining is disabled in every interaction state. Mobile ellipsis preserves the complete accessible room name.
- Updated the stylesheet cache version. No session storage, CID, room state, events, WebSocket or gameplay changes.
- Validation: Maven package (`-DskipTests`) and `npm run ci:verify` passed. All 21 targeted Playwright tests passed without retries or skips (presentation, existing room-return navigation and imprint).
- Presentation coverage: DE/EN, Dev/Clean, Light/Dark/System with both system appearances, desktop/mobile, consistent placement on Home/About/Invite/Imprint, hover/active/focus and accessible names. Existing responsive navigation tests cover 320, 375, 768, 769 and 1280px. Clean/light mobile and Dev/dark desktop screenshots were visually inspected.
- Local preview rebuilt at http://localhost:8080. No push or deployment. User-owned backlog edits remain outside this change.
- STOP: This visual polish is complete; no next story is authorized by this task.

## Presence reconnect correction — 2026-10-14

- Live logs confirmed a timing-dependent false sleep/wake transition: initial `pageshow` could open a replacement WebSocket while the first connection was still opening, and the delayed close of the older socket scheduled a disconnect for the shared participant identity.
- Client wake handling now leaves an in-progress connection untouched. Server disconnect handling checks for another open session for the same room participant and cancels stale disconnect timers when the replacement session is registered.
- Existing two-second unexpected-disconnect grace, heartbeat interval, host transfer rules, CID identity, room state, event protocol and gameplay remain unchanged.
- Added regression coverage for initial join, lifecycle wake signals, forced reconnect, real disconnect and a full heartbeat interval, plus a server unit test for overlapping sessions.
- Validation: clean Maven verify passed 31 tests with zero failures/skips; npm CI guards passed. Eight targeted Playwright cases passed without retries/skips, covering Presence, Heartbeat, Reconnect, Reload, Host/Close, Participation and both Dev/Clean vote-change flows.

## Full-width app header — 2026-10-14

- The shared header shell now spans the viewport while the existing 800px game and content containers remain centered and unchanged.
- Desktop header padding scales from 24px to 32px. The existing 768px breakpoint uses 16px mobile padding and continues to show only branding and the menu trigger.
- Header markup, branding assets, controls, menu lifecycle, preference state and events are unchanged. The stylesheet cache version was incremented.
- Validation: 46 targeted responsive/header/branding/control/content tests passed at 320, 375, 768, 769 and 1280px without retries or skips. The final 25-case header matrix and npm CI guards also passed.
- Visual inspection covered Dev/Clean in Light/Dark at 375px and 1280px. Alignment is consistent and no horizontal overflow was found.
- Local preview is running at http://localhost:8080. No push or deployment.
- STOP: Full-width header polish complete; no further UI work started.

## Result/deck center alignment — 2026-10-14

- Removed the desktop-only result-row offset that aligned statistics to the participant-chip column instead of the centered voting deck.
- No card-grid, participant-list, button, responsive wrapping, HTML or JavaScript rules changed.
- Four focused Chromium geometry cases passed without retries: Consensus and Average/Median/Range at 375px and 1280px. Result and deck centers match within the required 1px tolerance, with no horizontal overflow.
- No full E2E, Maven test or cross-browser suite was run for this CSS-only correction.
- STOP: Alignment polish complete; no further change started.

## Participant vote-chip transform correction — 2026-10-14

- Corrected the isolated desktop chip-centering conflict: an inherited grid-column placement changed the absolute-positioning reference, while the `chipIn` transform animation replaced the horizontal transform.
- Absolute participant chips now clear that obsolete grid placement and use the independent CSS `translate` property for X centering. The existing opacity/Y entrance animation remains intact.
- No result display, card grid, participant-row layout, card styling, HTML, JavaScript, state, events or gameplay changed.
- Two focused Chromium tests passed without retries at 375px and 1280px. They verify the pending position, animation at 0/110/220ms, revealed position and reset position; desktop chip and participant-row centers differ by no more than 1px.
- No full test suite was run.
- STOP: Vote-chip centering correction complete; no further change started.
