# Major Redesign Status

- Updated: 2026-10-12.
- Branch: feature/major-redesign.
- Last completed story: MR-008 Redesign Dev / Clean control.
- Previous commits: d245bbf (MR-007 theme controls), a1dc5eb (softened active header states).
- Current commit: style: redesign Dev Clean selector (resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Current story: None in progress. MR-009 remains TODO; await explicit approval under the story start gate.
- Implementation: Language, Theme and Dev/Clean use one harmonized segmented-control treatment in the settings container and stay synchronized through PPUI. The thin preference view adapter handles all three; menu.js exclusively owns dialog state/lifecycle. No game/backend/transport/storage changes.
- Tests: Maven verify 30 passed; npm run ci:verify passed; 55 selected Playwright tests passed in 2.8m with retries=0 and no skips. Covers keyboard, persistence, blocked storage, theme independence, Desktop/Mobile, both UI styles and Chromium/Firefox geometry. This is not a full-suite rerun.
- Remaining risk: Historical topic guest-start timeout and deferred empty-topic editor defect remain outside this story.
- Working tree: MR-008 changes ready for their separate commit; verify clean after commit/push.
- Evidence: target/mr008-* and target/preference-harmony-* logs/results (ignored artifacts). Focused harmony validation: four functional tests plus one Chromium/Firefox mobile geometry test, all passed without retries.
- Local preview: http://localhost:8080 runs the MR-008 build for user testing.
- Production: No deployment. STOP; MR-009 not started.
- Pending validation: The three menu preference controls were aligned to the compact desktop treatment in a user-approved, test-deferred correction. Run focused language/theme/ui-style browser tests and responsive visual checks in the next usage window.
