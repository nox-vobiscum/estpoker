# Major Redesign Status

- Updated: 2026-10-12.
- Branch: feature/major-redesign.
- Last completed story: MR-006 Redesign language controls.
- Previous commits: 5ebb9c9 (MR-005 preferences), 6e7d34b (post-redesign imprint backlog).
- Current commit: style: replace language flags with DE EN controls (resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Current story: None in progress. MR-007 remains TODO; await explicit approval under the story start gate.
- Implementation: Shared DE/EN text controls in desktop header and mobile menu. Header remains a thin PPUI adapter; menu.js exclusively owns dialog state/lifecycle. No game/backend/transport/storage changes.
- Tests: Maven verify 30 passed; npm run ci:verify passed; 53 selected Playwright tests passed in 2.0m with retries=0 and no skips. Desktop/mobile keyboard, language reload/synchronization, preferences, header/dialog, Chromium/Firefox geometry and core room flow covered. This is not a full-suite rerun.
- Remaining risk: Historical topic guest-start timeout and deferred empty-topic editor defect remain outside this story.
- Working tree: MR-006 changes committed separately; independently added story-start gate is preserved locally and excluded from the story commit.
- Evidence: target/mr006-maven-final.log, target/mr006-browser.log, target/mr006-results (ignored artifacts).
- Local preview: http://localhost:8080 runs the MR-006 build for user testing.
- Production: No deployment. STOP; MR-007 not started.
