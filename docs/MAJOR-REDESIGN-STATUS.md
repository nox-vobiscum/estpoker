# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed story: MR-009 Redesign menu toggles (DONE).
- Prerequisite commit: d79a0e0, completed MR-008 preference parity and exact 40px hamburger-height follow-up.
- Current commit: style: redesign menu switches (resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Current story: None in progress. MR-010 remains TODO; wait for explicit user approval. Recommended model for MR-010: Sol.
- Implementation: Flat switch rows, wrapping label/status layout, visible off/on tracks in both themes, centered white thumbs, explicit keyboard focus and reduced-motion support. Auto-reveal, topic, specials, hard mode and participation retain native inputs and existing IDs.
- Frozen contracts: No application JavaScript, event/payload, permission, gameplay, backend, transport or storage changes. Menu lifecycle remains exclusively in menu.js; PPUI owns preferences only.
- Tests: Maven verify 30 passed, zero skips; npm run ci:verify passed. 14 existing targeted Playwright tests passed. After correcting the new tests' detected focus CSS collision, 12 final selected cases passed (4 switch/permission Chromium/Firefox cases, 2 cross-engine geometry cases, 6 preference-parity cases), no retries/skips. Final package build and guards passed. No full-suite rerun.
- MR-008 follow-up: 36 selected preference/style/language cases validated, including the corrected row-layout assertion; visual height/style comparisons cover 320/375/768/769/1280px, Dev/Clean, Light/Dark/System.
- Evidence: target/mr008-followup-*.log, target/mr009-*.log, target/mr009-*.png and test-results/menu-toggle-presentation-*/switches.png (ignored local artifacts).
- Remaining risks: Historical topic startup flakiness and empty-topic editor defect remain outside this story. Hard mode intentionally retains its existing client-local behavior.
- Local preview: http://localhost:8080 runs the final MR-009 build with persistence disabled for local testing.
- Delivery: Separate feature-branch commit; verify clean tree and remote equality after push. No production deployment.
- STOP: Do not begin MR-010 automatically.
