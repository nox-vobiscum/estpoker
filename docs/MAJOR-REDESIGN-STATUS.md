# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed story: MR-013 landing/join form (DONE). MR-011 remains deferred until the user has header visuals.
- Current story: None in progress. MR-014 is TODO and requires separate approval; recommended model: Astra.
- Implementation: Landing and invite forms share scoped CSS for clearer labels, aligned inputs and CTA, and a subtle Clean surface. Dev remains plain. No form or game behavior changed.
- Dependency decision: MR-011 remains deferred. Its header visual must be checked against completed Clean surfaces when it resumes.
- Frozen contracts: No application JavaScript, event/payload, permission, gameplay, backend, transport or storage changes. Menu lifecycle remains exclusively in menu.js; PPUI owns preferences only.
- Tests: Maven verify 30 passed, zero skips; npm run ci:verify passed. 31 existing targeted Playwright tests passed, plus 2 new landing-form tests for validation, Enter submission, labels and narrow mobile width.
- Remaining risks: Historical topic startup flakiness and empty-topic editor defect remain outside this story.
- Local preview: http://localhost:8080 runs the MR-013 build with persistence disabled for local testing.
- Delivery: Separate feature-branch commit; no production deployment.
- STOP: Do not begin MR-014 or MR-011 automatically.
