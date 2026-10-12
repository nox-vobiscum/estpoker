# Major Redesign Status

- Updated: 2026-10-12.
- Branch: feature/major-redesign.
- Last completed story: MR-007 Redesign theme controls.
- Previous commits: e71c784 (MR-006 active-language refinement), df5a12b (story model guidance).
- Current commit: style: redesign responsive theme controls (resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Current story: None in progress. MR-008 remains TODO; await explicit approval under the story start gate.
- Implementation: Compact Light/Dark/System control in the desktop header and labeled choices in the mobile menu, synchronized through PPUI. Header controls remain a thin view adapter; menu.js exclusively owns dialog state/lifecycle. No game/backend/transport/storage changes.
- Tests: Maven verify 30 passed; npm run ci:verify passed; 76 selected Playwright tests passed in 2.2m with retries=0 and no skips. After final SVG refinement, 24 focused theme/header tests passed in 25.5s. Covers all theme modes, system changes, reload, keyboard, mobile, header/dialog geometry and both UI styles. This is not a full-suite rerun.
- Remaining risk: Historical topic guest-start timeout and deferred empty-topic editor defect remain outside this story.
- Working tree: MR-007 changes ready for their separate commit; verify clean after commit/push.
- Evidence: target/mr007-maven-final.log, target/mr007-browser.log, target/mr007-browser-final.log and result folders (ignored artifacts).
- Local preview: http://localhost:8080 runs the MR-007 build for user testing.
- Production: No deployment. STOP; MR-008 not started.
