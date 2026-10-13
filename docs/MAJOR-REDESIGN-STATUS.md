# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed work: Shape language consistency follow-up (DONE) after MR-015. MR-011 remains deferred until the user has header visuals.
- Current story: None in progress. MR-016 is TODO and requires separate approval; recommended model: Astra.
- Implementation: Three shared radius levels (10/14/20px) align compact segments, normal controls and major panels. Header menu trigger and settings close share 40px geometry, radius, border, surface, shadow and focus treatment. Room/game behavior is unchanged.
- Dependency decision: MR-011 remains deferred. Its header visual must be checked against completed Clean surfaces when it resumes.
- Frozen contracts: No application JavaScript, event/payload, permission, gameplay, backend, transport or storage changes. Menu lifecycle remains exclusively in menu.js; PPUI owns preferences only.
- Tests: Maven verify 30 passed, zero skips; npm run ci:verify passed. Twelve new cross-browser shape cases, 44 focused existing UI regressions, 14 final shape/topic cases and six final room geometry/participant/special cases passed without retries or skips. Computed geometry and screenshots checked in Chromium and Firefox.
- Remaining risks: Historical topic startup flakiness and empty-topic editor defect remain outside this story.
- Local preview: http://localhost:8080 runs the shape-polish build with persistence disabled for local testing.
- Delivery: Separate feature-branch commit; no production deployment.
- STOP: Shape follow-up complete. Do not begin MR-016 or MR-011 automatically.
