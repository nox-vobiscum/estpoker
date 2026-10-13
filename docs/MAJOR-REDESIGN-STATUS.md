# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed work: MR-011 final brand asset integration (DONE), after MR-015 and its shape-language follow-up.
- Current story: None in progress. MR-016 is TODO and requires separate approval; recommended model: Astra.
- Implementation: Original RBS PNGs are used in the shared header, PWA, Apple touch and social metadata. Visible in-page duplicate branding was removed from Home, About, Invite and Room; each page retains a meaningful H1. Original R ICO/PNG files are used only for favicons. The product name remains HTML text in the header; no menu, preference, room or game behavior changed.
- Dependency decision: MR-011 was resumed after the approved asset package arrived. Its graphics were integrated without artistic alteration and checked against Dev/Clean, Light/Dark/System and desktop/mobile layouts.
- Frozen contracts: No application JavaScript, event/payload, permission, gameplay, backend, transport or storage changes. Menu lifecycle remains exclusively in menu.js; PPUI owns preferences only.
- Tests: Isolated full Maven verify passed (30 tests, zero skips); npm run ci:verify passed. 37 focused Playwright header, SEO, language and asset cases passed, followed by seven brand cases including System theme, without retries or skips. The Home follow-up passed Maven test (30), npm CI guards and 29 focused header/SEO cases after correcting one test assumption about persisted language; no retry was used. SHA-256 hashes confirm exact file copies from the approved ZIP.
- Remaining risks: Historical topic startup flakiness and empty-topic editor defect remain outside this story. OS-specific favicon and install surfaces merit manual visual review.
- Local preview: The MR-011 build was tested on http://localhost:8081 with persistence disabled; the pre-existing localhost:8080 service was not changed.
- Delivery: Separate feature-branch commit; no production deployment.
- STOP: MR-011 complete. Do not begin MR-016 automatically.
