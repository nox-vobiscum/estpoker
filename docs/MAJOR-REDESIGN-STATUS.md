# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed story: MR-012 Clean-mode decorative surfaces (DONE). MR-011 is deferred until the user has header visuals.
- Current commit: style: add subtle Clean content surfaces (resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Current story: None in progress. MR-013 is TODO; await explicit user approval. Recommended model for MR-013: Sol.
- Implementation: Clean About intro and explanatory sections use subtle cards from existing palette/shadow tokens. Dev remains plain. Header, form, room and game behavior are unchanged.
- Dependency decision: User authorized MR-012 ahead of MR-011. It excludes the header. When MR-011 resumes, verify its brand visual against the completed Clean surfaces; MR-011 acceptance criteria remain open.
- Frozen contracts: No application JavaScript, event/payload, permission, gameplay, backend, transport or storage changes. Menu lifecycle remains exclusively in menu.js; PPUI owns preferences only.
- Tests: Maven verify 30 passed, zero skips; npm run ci:verify passed. All 25 existing ui-style Playwright tests passed. First new-test run exposed a color(srgb) parser error in the contrast helper; after correction, all 6 new surface tests passed without retries/skips. Matrix covers Dev/Clean, Light/Dark/System, 375/1280px, contrast, reduced motion and overflow. Full-page Clean screenshots inspected.
- Evidence: target/mr012-*.log and test-results/clean-surfaces-*/{light,dark}-about.png (ignored local artifacts).
- Remaining risks: Historical topic startup flakiness and empty-topic editor defect remain outside this story.
- Local preview: http://localhost:8080 runs the final MR-012 build with persistence disabled for local testing.
- Delivery: Separate feature-branch commit; verify clean tree and remote equality after push. No production deployment.
- STOP: Do not begin MR-013 or MR-011 automatically.
