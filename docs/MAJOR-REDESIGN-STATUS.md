# Major Redesign Status

- Updated: 2026-10-14.
- Branch: feature/major-redesign.
- Last completed work: MR-017 cross-browser visual consistency (DONE), following MR-016.
- Current story: None in progress. MR-018 final UI regression validation is next; recommended model: Astra. Separate story-start approval required.
- Implementation: Accessible main landmarks, special-card labels, sequence semantics and card selection state; preserved card focus after full grid rebuild; localized persistent result announcements; readable inactive preferences, public links and muted text; reduced-motion support for result and interaction effects.
- Frozen contracts: Game, WebSocket protocol, backend, permissions, CID, persistence and preference/menu owners remain unchanged.
- Tests: MR-017 focused Playwright matrix passed 65/65 in 2.6 minutes, with zero retries/skips. Chromium and Firefox covered Light/Dark Dev/Clean at mobile, tablet boundary and desktop widths; header, menu, room controls, About surfaces, preferences and accessibility remained usable.
- Audit evidence: Corresponding Chromium/Firefox controls differed by less than 2px and shared radii and normalized appearance. Pairwise screenshot inspection found only expected glyph rasterization and minor text-wrap differences, with no material geometry or clipping issue.
- Interrupted-work reconciliation: MR-016 was already fully recovered and committed before MR-017 began. MR-017 started from a clean tree and completed without interrupted steps or application fixes.
- Remaining limits: Safari/WebKit is outside MR-017's Chromium/Firefox scope. Manual NVDA/VoiceOver review, the known topic-editor defect and stale-room-return limitation remain unchanged.
- Local preview: Final MR-016 build is running at http://localhost:8080 with persistent room snapshots disabled.
- Delivery: Separate documentation commit on the feature branch; no push or production deployment.
- STOP: MR-017 complete. Do not begin MR-018 automatically.
