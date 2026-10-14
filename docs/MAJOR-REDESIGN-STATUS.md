# Major Redesign Status

- Updated: 2026-10-14.
- Branch: feature/major-redesign.
- Last completed work: MR-018 final UI regression validation (DONE), following MR-017.
- Current story: None. MR-018 checkpoints and coverage evidence are recorded in `docs/MR-018-VALIDATION.md`. Further stories require a separate start gate and approval.
- Implementation: Accessible main landmarks, special-card labels, sequence semantics and card selection state; preserved card focus after full grid rebuild; localized persistent result announcements; readable inactive preferences, public links and muted text; reduced-motion support for result and interaction effects.
- Frozen contracts: Game, WebSocket protocol, backend, permissions, CID, persistence and preference/menu owners remain unchanged.
- Tests: MR-018 Maven verify passed 30 tests; npm ci:verify passed. All 195 distinct Playwright tests have passing evidence across three shards plus targeted corrections, with zero automatic retries/skips. One false order assertion and one missing persistence assertion were corrected in tests only; application code unchanged.
- Audit evidence: Corresponding Chromium/Firefox controls differed by less than 2px and shared radii and normalized appearance. Pairwise screenshot inspection found only expected glyph rasterization and minor text-wrap differences, with no material geometry or clipping issue.
- Interrupted-work reconciliation: Shard 3 completed during the usage-limit interruption (64/64). On resume its report was verified, the pending TypeScript tuple correction applied, both changed tests checked and the final guards rerun successfully. No MR-018 validation step remains outstanding.
- Remaining limits: Safari/WebKit is outside MR-017's Chromium/Firefox scope. Manual NVDA/VoiceOver review, the known topic-editor defect and stale-room-return limitation remain unchanged.
- Local preview: Final MR-016 build is running at http://localhost:8080 with persistent room snapshots disabled.
- Delivery: Separate MR-018 test/documentation commit on the feature branch; no push or production deployment. User-added MR-020/MR-021 backlog entries remain outside this commit.
- STOP: MR-018 complete. Do not begin another story automatically.
