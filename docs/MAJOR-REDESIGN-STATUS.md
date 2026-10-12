# Major Redesign Status

- Updated: 2026-10-12.
- Branch: feature/major-redesign.
- Last completed story: MR-008 Redesign Dev / Clean control.
- Previous commits: d245bbf (MR-007 theme controls), a1dc5eb (softened active header states).
- Current commit: style: redesign Dev Clean selector (resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Current story: None in progress. MR-009 remains TODO; await explicit approval under the story start gate.
- Implementation: Equal-width Dev/Clean segmented control in the settings container, synchronized through PPUI. The thin preference view adapter handles language, theme and UI style; menu.js exclusively owns dialog state/lifecycle. No game/backend/transport/storage changes.
- Tests: Maven verify 30 passed; npm run ci:verify passed; 55 selected Playwright tests passed in 2.8m with retries=0 and no skips. Covers keyboard, persistence, blocked storage, theme independence, Desktop/Mobile, both UI styles and Chromium/Firefox geometry. This is not a full-suite rerun.
- Remaining risk: Historical topic guest-start timeout and deferred empty-topic editor defect remain outside this story.
- Working tree: MR-008 changes ready for their separate commit; verify clean after commit/push.
- Evidence: target/mr008-maven.log, target/mr008-browser.log and target/mr008-results (ignored artifacts).
- Local preview: http://localhost:8080 runs the MR-008 build for user testing.
- Production: No deployment. STOP; MR-009 not started.
