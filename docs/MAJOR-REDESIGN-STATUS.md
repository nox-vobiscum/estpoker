# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed story: MR-014 room controls (DONE). MR-011 remains deferred until the user has header visuals.
- Current story: None in progress. MR-015 is TODO and requires separate approval; recommended model: Sol.
- Implementation: Existing CSS now unifies voting-card states, participant/topic spacing, result values and host actions. Room DOM, application JavaScript and game behavior are unchanged.
- Dependency decision: MR-011 remains deferred. Its header visual must be checked against completed Clean surfaces when it resumes.
- Frozen contracts: No application JavaScript, event/payload, permission, gameplay, backend, transport or storage changes. Menu lifecycle remains exclusively in menu.js; PPUI owns preferences only.
- Tests: Maven verify 30 passed, zero skips; npm run ci:verify and final TypeScript check passed. 35 focused Playwright cases passed across initial/follow-up runs. The initial specials test lacked a vote-acknowledgement wait; its corrected synchronization passed. No tests skipped or automatically retried. Mobile Clean and desktop Dev Chromium/Firefox geometry passed; screenshots inspected.
- Remaining risks: Historical topic startup flakiness and empty-topic editor defect remain outside this story.
- Local preview: http://localhost:8080 runs the MR-014 build with persistence disabled for local testing.
- Delivery: Separate feature-branch commit; no production deployment.
- STOP: Do not begin MR-015 or MR-011 automatically.
