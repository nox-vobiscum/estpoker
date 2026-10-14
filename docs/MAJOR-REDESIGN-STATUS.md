# Major Redesign Status

- Updated: 2026-10-14.
- Branch: feature/major-redesign.
- Last completed work: MR-016 accessibility pass (DONE), following MR-019.
- Current story: None in progress. MR-017 cross-browser visual consistency is next; recommended model: Sol. Separate story-start approval required.
- Implementation: Accessible main landmarks, special-card labels, sequence semantics and card selection state; preserved card focus after full grid rebuild; localized persistent result announcements; readable inactive preferences, public links and muted text; reduced-motion support for result and interaction effects.
- Frozen contracts: Game, WebSocket protocol, backend, permissions, CID, persistence and preference/menu owners remain unchanged.
- Tests: Final Maven verify passed (30 tests, zero failures/errors/skips); npm run ci:verify passed. Final focused Playwright run: 37 passed, zero retries/skips. Includes Chromium/Firefox switch contracts, keyboard join/vote/reveal/reset, result announcements, menu focus/Escape, return navigation, responsive targets and preference parity.
- Audit evidence: Main preference and landing text/link/button contrast measured at least 4.5:1 in Light/Dark Dev/Clean. Representative mobile controls retain at least 24px targets and the existing 40px header geometry. Persistent result announcements clear after reset; reduced-motion chips remain visible.
- Interrupted-work reconciliation: Recovered the prior run (35 passed, two pointer failures), fixed partial-grid focus restoration, rebuilt and completed the entire focused run. Documentation and separate commit complete the story.
- Remaining limits: Screen-reader names/live-region DOM were tested automatically; actual NVDA/VoiceOver speech still merits manual review. This is not a full conformance certification. Existing topic-editor and stale-room-return limitations are unchanged.
- Local preview: Final MR-016 build is running at http://localhost:8080 with persistent room snapshots disabled.
- Delivery: Separate feature-branch commit; no push or production deployment.
- STOP: MR-016 complete. Do not begin MR-017 automatically.
