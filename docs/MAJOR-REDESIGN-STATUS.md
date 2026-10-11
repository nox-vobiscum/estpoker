# Major Redesign Status

- Updated: 2026-10-12.
- Active branch: feature/major-redesign (origin tracking).
- Last production/source commit: 66d3caa4299972d46cf60673369170de5b04ad33.
- Initialization commit: docs: initialize major redesign epic (the commit containing this file; resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Safety checkpoint: annotated pre-major-redesign at the production commit, pushed; existing annotation retained.
- Last completed story: None; epic initialization only.
- Current story: MR-001 READY, not started.
- Next recommended step: Wait for explicit approval for MR-001; then perform only the UI architecture audit.
- Tests: Maven verify 30 passed; npm ci:verify passed; local Playwright 95 passed in 2.9m, retries=0, no skips. Includes Chromium/Firefox geometry. See backlog for commands and log locations.
- Production: Health ok and Koyeb deployment success verified for 66d3caa. No deployment requested or performed for this documentation.
- Working tree: Clean before initialization; only the two epic documents are intended in this commit. Verify clean status after commit/push.
- Known risks: Earlier production E2E flakiness (auto-reveal/participation; earlier deck interactions); deferred topic editor close defect. Local clean baseline does not resolve these historical issues.
- Constraints: No UI/game changes performed. One story per run/commit; stop after each story. Never hide failures with retries, skips or weakened assertions.