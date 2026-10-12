# Major Redesign Status

- Updated: 2026-10-12.
- Branch: feature/major-redesign.
- Last completed story: MR-004, f74b834.
- Current story: MR-005 BLOCKED on the explicit MR-002 preference-default decision gate.
- Current checkpoint: docs: characterize preference defaults before MR-005 (commit containing this file).
- Work completed: Eight isolated Chromium baseline cases; findings in MAJOR-REDESIGN-PREFERENCES-BASELINE.md.
- Finding: Missing/invalid stored theme initializes dark then settles to System; denied storage remains dark and raises two page errors.
- Next step: Obtain approval for a consistent System fallback from bootstrap, including denied storage, or a precise alternative. Then continue MR-005 extraction and tests.
- Application changes: None; only three documentation files.
- Tests: Characterization only this run. Prior MR-004 Maven/guard/regression evidence remains recorded in backlog; no fresh full regression claimed.
- Working tree: Documentation checkpoint to be committed/pushed; verify clean status afterward.
- Risks: Defaults unresolved; language race handling and storage failure behavior still require implementation/testing.
- Invariants: Menu lifecycle stays in menu.js; no game, backend, protocol, identity, storage-key or infrastructure changes.
- No deployment. MR-006 not started.