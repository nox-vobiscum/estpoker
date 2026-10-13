# Major Redesign Status

- Updated: 2026-10-13.
- Branch: feature/major-redesign.
- Last completed work: MR-019 contextual active-room return navigation (DONE), after MR-011 brand asset integration.
- Current story: None in progress. MR-016 accessibility pass is next and requires separate approval; recommended model: Astra.
- Implementation: Home, About and Invite show a compact translated return link below the shared header when this tab has successfully joined a room. The link preserves the room and participant identity without preflight. Definitive close/kick/name rejection clears the matching context. An opener-created tab cannot inherit the link.
- Frozen contracts: Game, WebSocket protocol, backend, permissions, CID, persistence and preference/menu owners remain unchanged.
- Tests: Maven verify passed (30 tests, zero skips); npm run ci:verify passed. 36 focused Playwright cases passed, then 16 targeted cases passed after the final duplicate-name and opener-tab checks; no retries or skips.
- Remaining risks: Public pages cannot learn that another tab closed a room without a new server signal; the existing room-entry flow handles such stale links. MR-016 should review keyboard focus and contrast, MR-017 cross-browser behavior, and MR-018 final regression.
- Local preview: Updated MR-019 build is running at http://localhost:8080 with persistent room snapshots disabled.
- Delivery: Separate feature-branch commit; no production deployment.
- STOP: MR-019 complete. Do not begin MR-016 automatically.
