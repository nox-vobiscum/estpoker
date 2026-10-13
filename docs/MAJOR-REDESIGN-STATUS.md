# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed story: MR-008, including preference parity and hamburger-height follow-up.
- Current story: MR-009 approved by the user with Astra; starts after committing the prerequisite.
- Implementation: One compact preference presentation in header/menu; monochrome theme icons reused; 40px outer control height matches the unchanged hamburger. Active foreground and half-muted inactive choices; no active fill/underline.
- Tests: Build passed. 35 selected Playwright tests passed initially; the remaining keyboard test passed after correcting a computed-display assertion to row arrangement. New actual-dimension/style tests cover 320/375/768/769/1280px, Dev/Clean, Light/Dark/System. No skips/retries.
- Evidence: target/mr008-followup-*.log; tests/preference-parity.spec.ts.
- Frozen contracts: No JavaScript/state, event, permission, gameplay, transport or storage changes. Menu lifecycle remains exclusively in menu.js.
- Remaining risks: Historical topic startup flakiness and empty-topic editor defect remain outside this story.
- Local preview: http://localhost:8080 runs the corrected preference build.
- Production: No deployment. Complete MR-009 only, then STOP before MR-010.
