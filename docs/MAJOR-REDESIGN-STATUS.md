# Major Redesign Status

- Updated: 2026-10-12.
- Branch: feature/major-redesign.
- Last completed story: MR-005 Centralize UI preference state.
- Previous commit: 865bd9b (baseline/decision checkpoint); application baseline f74b834.
- Current commit: refactor: centralize UI preferences (commit containing this file; resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Current story: None in progress. MR-006 remains TODO; await explicit approval.
- Decision: User approved System fallback from first bootstrap, including denied storage. Valid stored values preserved; style defaults Dev; saved language precedes rendered locale.
- Implementation: ui-preferences.js is the only preference writer; header/menu subscribe and delegate. menuOpen and complete lifecycle remain in menu.js; no game/backend/identity/storage schema changes.
- Tests: Maven verify 30 passed; npm ci:verify passed. Full browser run 129 passed/2 failed; collision precondition corrected from server evidence, isolated collision/topic/preferences run 12 passed without retries/skips. All nine preference tests passed. Do not describe the full run as all green.
- Remaining risk: Topic guest-start timeout had no definitive diagnosis and did not reproduce in focused run. Historical flakiness and deferred empty-topic editor defect remain.
- Working tree: Story changes limited to preference extraction, relevant tests and docs; verify clean after commit/push.
- Evidence: target/mr005-*.log, mr005-results, mr005-focused-results; baseline and result documented in tracked docs.
- Production: No deployment. STOP; no MR-006 implementation started.