# Major Redesign Status

- Updated: 2026-10-12.
- Active branch: feature/major-redesign (origin tracking).
- Production/source baseline: 66d3caa4299972d46cf60673369170de5b04ad33; tag pre-major-redesign unchanged.
- Previous commit: 5a97229 (separate MR-002 correction: menu lifecycle stays in menu.js).
- Current story commit: feat: introduce shared responsive app header shell (commit containing this update; resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Last completed story: MR-003 shared header shell. MR-002 remains DONE with corrected state ownership.
- Current story: None in progress. MR-004 remains TODO.
- Next step: Wait for explicit MR-004 approval; rebuild settings container only.
- Tests: Maven verify 30 passed; npm ci:verify passed; 74 relevant Playwright tests passed without retries/skips (2.1m), including 21 new header tests. Chromium/Firefox geometry and desktop/mobile home screenshots checked.
- Working tree: Clean before work; intended MR-003 files documented in backlog. Check final status after commit/push.
- Implementation: Shared header on all four page types; one trigger; existing branding and language function; mobile language view in settings. Theme remains in settings until MR-007. No final brandmark.
- Functional boundary: No Java/backend, room.js, menu.js, specials-bridge.js, protocol, storage or infrastructure changes.
- Risks: Existing preference defaults, dialog focus containment, palette pointer issues and topic defect remain deferred; no claim of full regression beyond selected tests.
- Production: Not deployed; work stays on feature/major-redesign.
- STOP after this commit; no further story started.