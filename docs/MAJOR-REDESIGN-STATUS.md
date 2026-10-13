# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed story: MR-010 Redesign menu sections and hierarchy (DONE).
- Current commit: style: clarify settings menu hierarchy (resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Current story: None in progress. MR-011 is TODO; wait for explicit user approval. Recommended model for MR-011: Sol.
- Implementation: Existing order retained: mobile Language, Theme, Dev/Clean, Sequence, Room functions, Personal functions and More actions. Sections now have translated h4 headings, named groups and subtle dividers at larger boundaries. Existing controls, IDs and conditions are unchanged.
- Frozen contracts: No JavaScript, event/payload, permission, gameplay, backend, transport or storage changes. Menu lifecycle remains exclusively in menu.js; PPUI owns preferences only.
- Tests: Maven verify 30 passed, zero skips; npm run ci:verify passed; 21 targeted Playwright cases passed without retries/skips. Covers 320/768/1280px hierarchy and keyboard order, mobile scrolling, public page visibility, host/guest permissions, focus/scroll lifecycle, language/theme and exactly-once toggles. Desktop/mobile screenshots inspected. No full-suite rerun.
- Evidence: target/mr010-*.log and test-results/menu-hierarchy-*/menu-sections.png (ignored local artifacts).
- Remaining risks: Historical topic startup flakiness and empty-topic editor defect remain outside this story.
- Local preview: http://localhost:8080 runs the MR-010 build with persistence disabled for local testing.
- Delivery: Separate feature-branch commit; verify clean tree and remote equality after push. No production deployment.
- STOP: Do not begin MR-011 automatically.
