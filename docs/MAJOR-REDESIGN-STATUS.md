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
