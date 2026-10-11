# Major Redesign

## Epic Goal

Modernize the complete visual UI and presentation architecture of RBS' Planning Poker while preserving every existing functional effect. Initialization only: no audit or UI implementation has started.

## Frozen Functional Contracts

Room creation; join/invite; participant management; host logic and transfer; voting; reveal; reset; sequence changes; specials; auto-reveal; hard mode; spectator mode; topic; WebSocket protocol and event payloads; backend logic and endpoints; persistence and FTPS/room data structures; room/participant state; permissions; CID/identity behavior.

No gameplay refactoring. Before every commit inspect changes to GameService, GameWebSocketHandler, protocol, domain state, permissions, vote/reveal/reset, persistence schema and endpoints. Revert gameplay changes outside the explicitly authorized presentation scope.

## Design Principles

- Modern web app; responsive and mobile-first.
- Accessible keyboard, focus, semantics, contrast and reduced motion.
- Light/Dark/System; clearly distinguishable Dev/Clean.
- No new external UI library and no new game logic.
- Minimize parallel state sources; establish clear component responsibilities.
- Templates, DOM, CSS, controls, navigation and frontend presentation state may be rebuilt while preserving functional contracts and existing preference persistence.

## Safety Net and Baseline

- Date: 2026-10-12.
- Production/main checkpoint: 66d3caa4299972d46cf60673369170de5b04ad33.
- Existing annotated, pushed tag: pre-major-redesign. Its original production-checkpoint annotation was retained, not replaced with the newly requested wording.
- Active work branch: feature/major-redesign, created from that tag and pushed.
- Production health returned ok; GitHub/Koyeb deployment 7002337802 reported success for the checkpoint.
- mvnw.cmd verify: BUILD SUCCESS; 30 tests, zero failures/errors/skips.
- npm run ci:verify: passed menu contracts, helper guards and TypeScript checks.
- Local packaged application on port 18088; persistent-room snapshots disabled for the test server.
- PP_BASE_URL=http://localhost:18088; PP_ROOM_URL=http://localhost:18088/room?roomCode=major-baseline&participantName=Smoke.
- npx playwright test --retries=0 --output target/major-redesign-baseline-results: 95 passed in 2.9m, zero failed/skipped/retried. Includes Chromium/Firefox geometry comparisons, responsive styles, preferences/storage, SEO and room flows.
- Local logs: target/major-redesign-baseline-{maven,guards,browser,server}.log; browser artifacts under target/major-redesign-baseline-results and playwright-report (ignored, not durable repository artifacts).
- This is a clean local baseline, not a guarantee of consistently green production E2E.

### Known Existing Issues (separate from this run)

- Production checkpoint E2E previously required retries for auto-reveal and participation (6 passed, 2 flaky). Earlier deck/specials click interception and auto-reveal ordering/visibility failures are recorded in the preceding work. None reproduced in this local baseline; do not hide them with retries or weakened assertions.
- Deferred topic editor defect: removing the topic can prevent closing with confirm/cancel; see BACKLOG.md. Not fixed by this epic initialization.

## Execution Rules

Only one story at a time. After explicit approval: read scope, set IN PROGRESS, implement only that scope, run relevant tests, record results/findings/decisions/downstream risks, mark DONE only when acceptance criteria hold, commit separately, update MAJOR-REDESIGN-STATUS.md, then STOP. User approval is required before the next story.

Allowed statuses: TODO, READY, IN PROGRESS, BLOCKED, DONE.
MR-001 is READY but not authorized to start. MR-002 through MR-018 are TODO.
Stop and report an unclean baseline. Never manufacture green tests through skips, retries or weaker assertions. Intentional DOM changes may require selector updates while retaining functional assertions.
After architecture changes additionally verify menu open/close, state synchronization, exactly-once toggles, mobile collapse, focus/Escape/overlay. MR-018 runs the full relevant suite.
Keep each run bounded to analysis, one story, or its validation. When available usage budget falls below roughly 20%, start no new story; write a handoff and stop. Usage quota is not exposed to this run.
Results below are placeholders, not completed analysis.

## User Stories

### MR-001 — UI architecture audit

- ID: MR-001
- Title: UI architecture audit
- Goal: Document existing header/menu/UI structure, events, state flows and fragile couplings.
- Scope: Read templates, scripts, styles and tests; map owners, listeners, selectors, state and frozen-contract boundaries.
- Out of Scope: Any source, DOM or visual changes. All frozen functional contracts apply.
- Acceptance Criteria: A traceable inventory and coupling/risk map exists; findings cite actual files; no UI changes.
- Tests: Read-only trace against existing tests; verify documentation-only diff.
- Dependencies: None; explicit user approval required.
- Status: READY
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-002 — Define target UI architecture

- ID: MR-002
- Title: Define target UI architecture
- Goal: Specify the target presentation architecture.
- Scope: Header, utility cluster, settings drawer/sheet, central UI synchronization and responsive strategy.
- Out of Scope: Visual implementation and gameplay redesign. All frozen functional contracts apply.
- Acceptance Criteria: Responsibilities, state ownership, responsive behavior and migration boundaries are documented.
- Tests: Review architecture against MR-001 and all frozen contracts.
- Dependencies: MR-001
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-003 — Introduce redesigned app header shell

- ID: MR-003
- Title: Introduce redesigned app header shell
- Goal: Establish a responsive header shell.
- Scope: Desktop branding left and homogeneous language/theme/menu cluster; mobile branding and menu only.
- Out of Scope: Game behavior and unrelated room UI. All frozen functional contracts apply.
- Acceptance Criteria: Desktop and mobile show the specified controls without duplicate mobile menu entry points.
- Tests: Desktop/mobile layout, navigation, keyboard and existing menu contracts.
- Dependencies: MR-002
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-004 — Rebuild settings container

- ID: MR-004
- Title: Rebuild settings container
- Goal: Build a robust drawer/sheet presentation component.
- Scope: Right drawer on desktop; broad or near-fullscreen mobile sheet; retain open/close/overlay/Escape/focus behavior.
- Out of Scope: Setting semantics and game events. All frozen functional contracts apply.
- Acceptance Criteria: Container scrolls, opens and closes reliably; focus enters and returns appropriately.
- Tests: Menu open/close, overlay, Escape, focus, mobile scroll and exactly-once handlers.
- Dependencies: MR-003
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-005 — Centralize UI preference state

- ID: MR-005
- Title: Centralize UI preference state
- Goal: Synchronize presentation preferences through one clear source of truth.
- Scope: Theme, language, Dev/Clean and menu state; reuse current persistence keys and values.
- Out of Scope: Game state, game events and storage migration. All frozen functional contracts apply.
- Acceptance Criteria: Controls and rendered state agree after changes/reload without parallel competing state sources.
- Tests: Preference reload, blocked storage, state sync and exactly-once events.
- Dependencies: MR-004
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-006 — Redesign language controls

- ID: MR-006
- Title: Redesign language controls
- Goal: Present clear DE/EN controls.
- Scope: Desktop utility controls and mobile menu language controls without flags.
- Out of Scope: Translation content and language persistence semantics. All frozen functional contracts apply.
- Acceptance Criteria: Both layouts switch language with the same existing effect and synchronized state.
- Tests: DE/EN switching, reload, responsive controls and keyboard.
- Dependencies: MR-005
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-007 — Redesign theme controls

- ID: MR-007
- Title: Redesign theme controls
- Goal: Modernize theme selection without changing its behavior.
- Scope: Compact desktop control; mobile Light/Dark/System menu choices.
- Out of Scope: Theme semantics or new preference values. All frozen functional contracts apply.
- Acceptance Criteria: All three modes persist and follow existing system-theme behavior.
- Tests: Light/Dark/System, system changes, reload, keyboard and mobile.
- Dependencies: MR-005, MR-006
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-008 — Redesign Dev / Clean control

- ID: MR-008
- Title: Redesign Dev / Clean control
- Goal: Introduce a contemporary segmented style control.
- Scope: Dev/Clean presentation selector and synchronized selected state.
- Out of Scope: Style preference semantics or game state. All frozen functional contracts apply.
- Acceptance Criteria: Both choices work with existing storage and remain accessible and unambiguous.
- Tests: Keyboard selection, persistence, theme independence and responsive layout.
- Dependencies: MR-005, MR-007
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-009 — Redesign menu toggles

- ID: MR-009
- Title: Redesign menu toggles
- Goal: Modernize room-function toggle presentation.
- Scope: Auto-reveal, topic, specials, hard mode and existing menu toggles.
- Out of Scope: Events, payloads, permissions and host-only rules. All frozen functional contracts apply.
- Acceptance Criteria: All toggles preserve their exact functional effect and permission visibility; no duplicate dispatch.
- Tests: Menu guard, exactly-once toggles, host/guest permissions and affected room-flow tests.
- Dependencies: MR-004, MR-005, MR-008
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-010 — Redesign menu sections and hierarchy

- ID: MR-010
- Title: Redesign menu sections and hierarchy
- Goal: Organize settings into a clear hierarchy.
- Scope: Language, theme, Dev/Clean, sequence, room functions, personal functions, secondary actions, in that order.
- Out of Scope: Changing setting behavior or availability. All frozen functional contracts apply.
- Acceptance Criteria: Order and grouping are clear on desktop/mobile; existing functions remain reachable.
- Tests: Menu reachability, host/guest visibility, keyboard order and mobile scrolling.
- Dependencies: MR-009
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-011 — Introduce new brand header visual

- ID: MR-011
- Title: Introduce new brand header visual
- Goal: Strengthen the product identity.
- Scope: Card/Scrum-inspired mark; RBS' Planning Poker; optional short subline; Light/Dark support.
- Out of Scope: PP abbreviation, product rename and infrastructure. All frozen functional contracts apply.
- Acceptance Criteria: Full product name and legible brandmark work in both themes and narrow layouts.
- Tests: Light/Dark, responsive overflow, accessible naming and navigation.
- Dependencies: MR-003, MR-010
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-012 — Introduce Clean-mode decorative surfaces

- ID: MR-012
- Title: Introduce Clean-mode decorative surfaces
- Goal: Differentiate Clean visually through subtle surfaces.
- Scope: Subtle cards/surfaces in Clean; Dev remains technical, reduced and without equivalent decoration.
- Out of Scope: Functional changes and shared game state. All frozen functional contracts apply.
- Acceptance Criteria: Modes are visibly distinct while content remains legible and unobstructed.
- Tests: Theme/style matrix, contrast, reduced motion and responsive overflow.
- Dependencies: MR-008, MR-011
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-013 — Redesign landing/join form

- ID: MR-013
- Title: Redesign landing/join form
- Goal: Modernize form controls and hierarchy.
- Scope: Inputs, labels, CTA and visual hierarchy.
- Out of Scope: Submit, validation, room creation, join or invite behavior. All frozen functional contracts apply.
- Acceptance Criteria: Same data and actions produce the same result; labels and errors remain accessible.
- Tests: Create/join/invite, invalid input, keyboard submission and mobile layout.
- Dependencies: MR-012
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-014 — Redesign room controls

- ID: MR-014
- Title: Redesign room controls
- Goal: Visually unify room presentation.
- Scope: Voting cards, buttons, participant rows, topic UI and statistics.
- Out of Scope: Any game mechanics or fixes to deferred functional defects. All frozen functional contracts apply.
- Acceptance Criteria: Controls retain their exact effects, permissions and state rendering.
- Tests: Voting/reveal/reset, sequences, specials, host transfer, spectator, topic and stats contracts.
- Dependencies: MR-009, MR-013
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-015 — Responsive mobile refinement

- ID: MR-015
- Title: Responsive mobile refinement
- Goal: Refine all new components for small screens.
- Scope: Single mobile menu entry point, touch-friendly controls and scrollable settings.
- Out of Scope: New features and game logic. All frozen functional contracts apply.
- Acceptance Criteria: Small screens have no clipped content, blocked controls or duplicate entry points.
- Tests: Narrow/mobile viewports, orientation, footer/content visibility and settings scrolling.
- Dependencies: MR-014
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-016 — Accessibility pass

- ID: MR-016
- Title: Accessibility pass
- Goal: Validate and refine accessible interaction.
- Scope: Keyboard, focus, ARIA, contrast, touch targets and reduced motion.
- Out of Scope: Functional redesign or new game behavior. All frozen functional contracts apply.
- Acceptance Criteria: Core flows work without a pointer; focus/semantics and visual accessibility checks are documented.
- Tests: Keyboard flows, Escape/focus return, screen-reader announcements, contrast and reduced motion.
- Dependencies: MR-015
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-017 — Cross-browser visual consistency

- ID: MR-017
- Title: Cross-browser visual consistency
- Goal: Verify consistent presentation across supported engines.
- Scope: Chromium and Firefox: Light Dev, Dark Dev, Light Clean and Dark Clean.
- Out of Scope: Pixel-identical font rendering or functional changes. All frozen functional contracts apply.
- Acceptance Criteria: All four combinations remain usable and geometrically coherent in both engines.
- Tests: Cross-browser geometry and visual review on desktop/mobile; record material differences.
- Dependencies: MR-016
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.


### MR-018 — Final UI regression validation

- ID: MR-018
- Title: Final UI regression validation
- Goal: Demonstrate that redesign preserved the frozen functional contracts.
- Scope: Full relevant functional regression and final presentation/accessibility checks.
- Out of Scope: New features, gameplay refactoring and infrastructure changes. All frozen functional contracts apply.
- Acceptance Criteria: Every frozen contract has recorded evidence; no unexplained failures or weakened assertions remain.
- Tests: Maven verify, npm ci:verify, full relevant Playwright suite without retries/skips; verify all frozen contracts and report any coverage gaps.
- Dependencies: MR-017
- Status: TODO
- Notes / Findings: Not started; findings pending explicit story approval.
- Resulting Decisions: None yet.

#### Result

- Changed files: None.
- Technical decision: Pending.
- Visual result: No changes.
- Tests: Not run for this story; initialization baseline above.
- New findings: Pending.
- Effects on following stories: Pending.
- Open risks: Pending analysis; known baseline risks above.

