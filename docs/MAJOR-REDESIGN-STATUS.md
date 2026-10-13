# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed story: MR-015 responsive mobile refinement (DONE). MR-011 remains deferred until the user has header visuals.
- Current story: None in progress. MR-016 is TODO and requires separate approval; recommended model: Astra.
- Implementation: Room actions have larger mobile touch targets. Long room codes truncate before the copy button. The existing single menu entry, scrollable settings and compact footer remain in place.
- Dependency decision: MR-011 remains deferred. Its header visual must be checked against completed Clean surfaces when it resumes.
- Frozen contracts: No application JavaScript, event/payload, permission, gameplay, backend, transport or storage changes. Menu lifecycle remains exclusively in menu.js; PPUI owns preferences only.
- Tests: Maven verify 30 passed, zero skips; npm run ci:verify and final TypeScript check passed. 30 mobile/header/settings Playwright cases passed after correcting test timing, plus 3 topic/spectator cases. Portrait/landscape content, footer, menu scrolling, copy-control hit target and horizontal overflow were checked without retries or skips.
- Remaining risks: Historical topic startup flakiness and empty-topic editor defect remain outside this story.
- Local preview: http://localhost:8080 runs the MR-015 build with persistence disabled for local testing.
- Delivery: Separate feature-branch commit; no production deployment.
- STOP: Do not begin MR-016 or MR-011 automatically.
