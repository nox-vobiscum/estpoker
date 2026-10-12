# Major Redesign Status

- Updated: 2026-10-12.
- Active branch: feature/major-redesign (origin tracking).
- Production/source baseline: 66d3caa4299972d46cf60673369170de5b04ad33; pre-major-redesign tag unchanged.
- Previous story commit: 800cbb7 (MR-003); architecture correction: 5a97229.
- Current story commit: feat: rebuild responsive settings container (commit containing this file; resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Last completed story: MR-004 Rebuild settings container.
- Current story: None in progress. MR-005 remains TODO, not started.
- Next step: Wait for explicit MR-005 approval; characterize existing preference defaults before extracting preference ownership. menuOpen stays exclusively in menu.js.
- Tests: Maven verify 30 passed; npm ci:verify passed. Full browser run 119 passed/3 new animation-timing failures; unchanged exact assertions synchronized to animation completion, six dialog cases passed. Subsequent overlay CSS correction validated by 44 affected tests passing. No runner retries/skips. All 122 distinct cases have passing evidence across runs; no single final full-suite pass claimed.
- Verification: Diff limited to dialog presentation/lifecycle, close-selector adaptations, new tests and documentation. Backend, room.js, protocol, identity and storage unchanged. Existing event guard and exactly-once tests pass.
- Working tree: Intended files documented in backlog; final clean state verified after commit/push.
- Known risks: Preference default mismatch, pre-existing palette pointer issue, deferred topic defect and historical production flakiness. No physical mobile/Safari verification.
- Local evidence: target/mr004-*.log and target/mr004-final-results (ignored artifacts).
- Production: No deployment; work remains on feature/major-redesign.
- STOP. Do not begin MR-005 automatically.