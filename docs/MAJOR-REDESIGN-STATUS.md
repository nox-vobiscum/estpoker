# Major Redesign Status

- Updated: 2026-10-12.
- Active branch: feature/major-redesign (origin tracking).
- Last production/source commit: 66d3caa4299972d46cf60673369170de5b04ad33.
- Previous story commit: 3cf4d3d (MR-001).
- Current story commit: docs: define major redesign target UI architecture (commit containing this update; resolve with git log -1 -- docs/MAJOR-REDESIGN-STATUS.md).
- Safety checkpoint: annotated pre-major-redesign, unchanged and pushed.
- Last completed story: MR-002 Define target UI architecture.
- Current story: None in progress; MR-003 remains TODO pending explicit approval.
- Next recommended step: Approve MR-003 to build only the shared header shell according to MAJOR-REDESIGN-ARCHITECTURE.md.
- Tests this run: Architecture reviewed against MR-001 and frozen contracts; documentation-only diff and whitespace validation. No runtime tests repeated for unchanged source.
- Baseline: Initialization had 30 Maven and 95 Playwright passes without runner retries/skips; MR-001 ci:verify passed. Coverage limits remain documented in the audit.
- Working tree: Clean at start; only architecture/backlog/status documents belong to this story commit. Verify final status after commit/push.
- Decisions: Shared header; one settings drawer/sheet; dedicated preference owner; existing game adapters untouched; mobile <=768px; staged implementation without duplicate runtime state.
- Known risks: Characterize existing theme/language default precedence before MR-005; preserve sequence DOM reconciliation and event fences; verify real pointer behavior and full dialog focus lifecycle. Historical production flakes and deferred topic defect remain.
- Production: No changes/deployment performed.
- Constraints: No UI/game/transport/storage/test/infrastructure changes. STOP; await MR-003 approval.