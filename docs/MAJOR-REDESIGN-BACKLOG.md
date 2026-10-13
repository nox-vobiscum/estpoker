# Major Redesign

# MANDATORY STORY START GATE

This gate is mandatory before starting ANY MR-xxx story.

1. STOP before making any source-code change.
2. Re-read:
   - README.md
   - docs/BRIEFING.md
   - docs/MAJOR-REDESIGN-BACKLOG.md
   - docs/MAJOR-REDESIGN-STATUS.md
3. Confirm:
   - active Git branch
   - last completed MR
   - next MR
   - frozen functional contracts
4. Read the Recommended Model for the next MR.
5. Report:
   - currently selected model
   - recommended model
   - whether a model switch is recommended
6. WAIT for explicit user approval.

DO NOT edit files, run implementation commands, change story status,
or begin implementation before the user has explicitly approved the story start.

After approval, complete ONLY that MR through:
implementation → tests → documentation → DONE → separate commit → status update.

Then STOP.

## Epic Goal

Modernize the complete visual UI and presentation architecture of RBS' Planning Poker while preserving every existing functional effect. MR-001 through MR-008 completed, including the shared UI preference owner.

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

Only one story at a time. Before every MR-xxx story, re-read README.md, docs/BRIEFING.md, docs/MAJOR-REDESIGN-BACKLOG.md and docs/MAJOR-REDESIGN-STATUS.md; confirm the active branch, the last completed story and the frozen functional contracts. Then report the model recommended for that story. If the currently selected model differs, explicitly propose the model switch and WAIT for user confirmation before doing any implementation work. After explicit approval: set the story IN PROGRESS, implement only that scope through its acceptance criteria, run relevant tests, record results/findings/decisions/downstream risks, mark DONE only when acceptance criteria hold, commit separately, update MAJOR-REDESIGN-STATUS.md, then STOP. User approval is required before the next story.

Allowed statuses: TODO, READY, IN PROGRESS, BLOCKED, DONE.
MR-001 is DONE following explicit approval on 2026-10-12. MR-002 through MR-008 are DONE; MR-009 through MR-018 are TODO.
Stop and report an unclean baseline. Never manufacture green tests through skips, retries or weaker assertions. Intentional DOM changes may require selector updates while retaining functional assertions.
After architecture changes additionally verify menu open/close, state synchronization, exactly-once toggles, mobile collapse, focus/Escape/overlay. MR-018 runs the full relevant suite.
Keep each run bounded to analysis, one story, or its validation. When available usage budget falls below roughly 20%, start no new story; write a handoff and stop. Usage quota is not exposed to this run.
MR-001 through MR-008 results are recorded below; later story results remain placeholders.

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
- Status: DONE
- Recommended Model: **Astra** — Architecture/audit work with broad repository context and risk mapping.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: See [MR-001 audit](MAJOR-REDESIGN-AUDIT.md) for source ownership, load order, event/state flows, DOM/CSS coupling and test coverage limits.
- Resulting Decisions: Preserve functional adapters and current event/payload effects; defer target architecture to MR-002. No UI or gameplay implementation.

#### Result

- Changed files: docs/MAJOR-REDESIGN-AUDIT.md, docs/MAJOR-REDESIGN-BACKLOG.md, docs/MAJOR-REDESIGN-STATUS.md.
- Technical decision: Documentation-only audit; no target architecture selected.
- Visual result: Unchanged.
- Tests: npm run ci:verify passed; documentation-only diff and whitespace checks. Existing 30 Maven/95 Playwright baseline retained, not rerun for documentation.
- New findings: Shared binding ownership, sequence DOM reconciliation, multiple preference writers, inline layout writers, palette event fences and dialog focus coverage gaps.
- Effects on following stories: MR-002 must resolve ownership/load-order/responsive decisions; MR-004/016 need explicit focus lifecycle evidence; MR-005 preserves preference behavior; MR-009/014 preserve exactly-once events and delegation.
- Open risks: Existing production flakes and topic defect remain; passing keyboard-based specials tests does not demonstrate reliable pointer hit-testing.

### MR-002 — Define target UI architecture

- ID: MR-002
- Title: Define target UI architecture
- Goal: Specify the target presentation architecture.
- Scope: Header, utility cluster, settings drawer/sheet, central UI synchronization and responsive strategy.
- Out of Scope: Visual implementation and gameplay redesign. All frozen functional contracts apply.
- Acceptance Criteria: Responsibilities, state ownership, responsive behavior and migration boundaries are documented.
- Tests: Review architecture against MR-001 and all frozen contracts.
- Dependencies: MR-001
- Status: DONE
- Recommended Model: **Astra** — Architecture decisions and ownership boundaries.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: See [target architecture](MAJOR-REDESIGN-ARCHITECTURE.md) for component ownership, lifecycle, state API, migration boundaries and per-story validation gates.
- Resulting Decisions: Corrected before MR-003: menuOpen and the complete dialog lifecycle stay exclusively in menu.js; PPUI contains preferences only. Header controls become a thin adapter or integrate into the header without a second state owner. Shared app-header fragment; single responsive menu; dedicated UI preference module extracted in MR-005; preserve room adapter/event contracts; new shell breakpoint at 768px.

#### Result

- Changed files: docs/MAJOR-REDESIGN-ARCHITECTURE.md, docs/MAJOR-REDESIGN-BACKLOG.md, docs/MAJOR-REDESIGN-STATUS.md.
- Technical decision: Reuse Thymeleaf/vanilla JS/styles.css; no external library or parallel application. Separate presentation preferences from frozen room logic.
- Visual result: None; architecture only.
- Tests: Static review against MR-001 findings and frozen contracts; documentation-only staged diff and whitespace checks. Runtime suite not repeated for unchanged source.
- New findings: Default precedence needs characterization before preference extraction; one responsive dialog must own focus and resize lifecycle.
- Effects on following stories: MR-003 builds shell only; MR-004 implements lifecycle; MR-005 characterizes and preserves current preference outcomes before extraction. Remaining stories follow the architecture validation table.
- Open risks: Preference default conflicts, palette hit-testing, existing inline styles, focus coverage gaps, production flakes and deferred topic defect remain explicit gates.

### MR-003 — Introduce redesigned app header shell

- ID: MR-003
- Title: Introduce redesigned app header shell
- Goal: Establish a responsive header shell.
- Scope: Desktop branding left and homogeneous language/theme/menu cluster; mobile branding and menu only.
- Out of Scope: Game behavior and unrelated room UI. All frozen functional contracts apply.
- Acceptance Criteria: Desktop and mobile show the specified controls without duplicate mobile menu entry points.
- Tests: Desktop/mobile layout, navigation, keyboard and existing menu contracts.
- Dependencies: MR-002
- Status: DONE
- Recommended Model: **Sol** — Bounded presentation-shell implementation with frozen behavior.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: One shared header on home/about/invite/room. Existing branding left, existing language views and one menu trigger in the desktop utility cluster; mobile header exposes only the trigger. Theme remains in the existing menu until MR-007; no replacement theme behavior introduced.
- Resulting Decisions: Reuse the existing language fragment with unique desktop/mobile IDs and the same setLang function/events. Mobile language view lives in settings. Preserve menu/specials/header/room deferred script order via app-header headerScripts fragment.

#### Result

- Changed files: src/main/resources/templates/fragments/app-header.html (new shell/script fragment); header-controls.html (reusable language markup); menu.html (trigger moved, mobile language view); head.html (CSS version); index.html, about.html, invite.html, room.html (shared composition); static/styles.css (scoped shell/responsive rules); static/js/header-controls.js (bind/reflect both views through existing language function); tests/header-shell.spec.ts (21 responsive regression cases); this backlog and MAJOR-REDESIGN-STATUS.md.
- Technical decision: Normal-flow shared header, 768px mobile boundary, unique menu trigger and overlay. No new preference owner or menu lifecycle code. Existing page H1/content retained; existing favicon used without a new brandmark.
- Visual result: Branding left and desktop language/menu cluster right; mobile branding plus menu only, with language available inside the existing settings panel. Desktop/mobile home screenshots inspected; theme/style geometry compared in Chromium and Firefox.
- Tests: mvnw.cmd verify BUILD SUCCESS (30 tests, zero failures/errors/skips); npm run ci:verify passed; 74 selected Playwright tests passed in 2.1m with --retries=0, no skips. Includes 21 header tests across all four pages at 320/375/768/769/1280px, resize state retention, menu, language, theme, exactly-once toggles, cross-browser geometry, UI styles, SEO and core room flow.
- New findings: Header language markup can serve both views without duplicating state or language behavior. Desktop compact theme and final flag-free controls remain MR-006/007 work.
- Effects on following stories: MR-004 must use the existing unique trigger and sibling overlay; headerScripts must remain after menu scripts. MR-005 must keep menu state in menu.js per corrected MR-002. MR-006 can replace visual language markup without introducing new state.
- Open risks: Existing preference default discrepancy, full dialog focus containment, palette pointer issues and deferred topic defect remain outside MR-003. Public page H1 branding is intentionally retained until the owning content/brand stories.
- Local evidence: target/mr003-maven.log, target/mr003-browser.log, target/mr003-results and playwright-report (ignored artifacts).

### MR-004 — Rebuild settings container

- ID: MR-004
- Title: Rebuild settings container
- Goal: Build a robust drawer/sheet presentation component.
- Scope: Right drawer on desktop; broad or near-fullscreen mobile sheet; retain open/close/overlay/Escape/focus behavior.
- Out of Scope: Setting semantics and game events. All frozen functional contracts apply.
- Acceptance Criteria: Container scrolls, opens and closes reliably; focus enters and returns appropriately.
- Tests: Menu open/close, overlay, Escape, focus, mobile scroll and exactly-once handlers.
- Dependencies: MR-003
- Status: DONE
- Recommended Model: **Astra** — Dialog lifecycle, focus, inertness and event-ordering are interaction-critical.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: One responsive settings container: full-height right drawer above 768px, broad inset mobile sheet. All transient state and lifecycle remain private to menu.js.
- Resulting Decisions: Explicit in-dialog close control; inert background and CSS scroll locking; focus entry, Tab wrapping, Escape capture, focus return and resize repair. Existing game events and settings functions retained.

#### Result

- Changed files: static/js/menu.js (dialog lifecycle only); static/styles.css (drawer/sheet, overlay layer, scroll lock and reduced motion); templates/fragments/menu.html (accessible title and close button); fragments/head.html (CSS cache version); tests/settings-container.spec.ts (six lifecycle cases); existing close selectors in auto-reveal, header-shell, menu-smoke, participation-spectator, specials-stats, toggles, ui-style and utils/helpers tests; backlog/status.
- Technical decision: menuOpen stays private to menu.js. Preserve pre-existing inert and scroll-lock states. Header trigger is behind the modal and inert while open; tests close via the dialog button without weakening functional assertions.
- Visual result: Right desktop drawer and near-fullscreen mobile sheet, scrollable settings, sticky heading/close action and safe-area spacing. Existing controls, theme and game logic unchanged. Desktop/mobile screenshots inspected; overlay stacking corrected after visual review.
- Tests: Maven verify BUILD SUCCESS, 30 passed, zero failures/errors/skips. npm run ci:verify passed. Initial full Playwright run: 119 passed, three new geometry cases measured during entry animation. Fixed test synchronization by awaiting animation completion, keeping exact assertions. All six dialog tests then passed. After the CSS overlay-layer correction, all 44 affected header/menu/toggle/dialog/cross-browser geometry tests passed (1.9m). No runner retries/skips used; all 122 distinct cases have passing evidence across these runs, not a claimed single all-green full-suite rerun.
- New findings: Header trigger previously painted above overlay; now covered and guarded by a hit-testing assertion. Escape must be captured before nested palette event fences. Animated geometry requires settled-frame measurement.
- Effects on following stories: MR-005 consumes preferences only and must not own menuOpen. Preserve dialog lifecycle when adapting settings views; use menuCloseButton while modal background is inert.
- Open risks: Existing preference-default discrepancy, palette pointer behavior and deferred topic defect remain outside this story. Tests cover Chromium dialog behavior and Chromium/Firefox geometry; no physical mobile/Safari validation claimed.
- Local evidence: target/mr004-maven.log, mr004-browser.log, mr004-settings.log, mr004-final-browser.log; target/mr004-final-results screenshots/traces (ignored artifacts).

### MR-005 — Centralize UI preference state

- ID: MR-005
- Title: Centralize UI preference state
- Goal: Synchronize presentation preferences through one clear source of truth.
- Scope: Theme, language and Dev/Clean; reuse current persistence keys and values. Transient menu state and all dialog lifecycle remain exclusively in menu.js.
- Out of Scope: Game state, game events and storage migration. All frozen functional contracts apply.
- Acceptance Criteria: Controls and rendered state agree after changes/reload without parallel competing state sources.
- Tests: Preference reload, blocked storage, state sync and exactly-once events.
- Dependencies: MR-004
- Status: DONE
- Recommended Model: **Astra** — Central preference ownership and synchronization are state-sensitive.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: Baseline characterized; user approved System as the initial/default theme on 2026-10-12. Existing valid keys/values retained. Denied storage now leaves preferences operational in memory.
- Resulting Decisions: PPUI owns themeMode/language/uiStyle only. menu.js exclusively owns dialog state/lifecycle. Header and menu subscribe/render and delegate preference actions; no duplicate preference writers remain.

#### Result

- Changed files: static/js/ui-preferences.js (new synchronous owner); static/js/header-controls.js (thin adapter); static/js/menu.js (preference adapter, lifecycle/game dispatch unchanged); fragments/head.html (single early initializer); app-header.html/menu.html (script versions); tests/ui-preferences.spec.ts (nine cases); duplicate-name-suffix.spec.ts (server-confirmed first join precondition); storage.spec.ts (ownership comment); architecture/baseline/backlog/status docs.
- Technical decision: Immutable snapshots, subscriptions, safe current-key persistence, System/Dev defaults, saved-language precedence, asynchronous message generation guard, retryable failed language load, existing setLanguage forwarding and language events. No cross-tab feature, new storage keys, room state or menuOpen in PPUI.
- Visual result: Existing controls/layout preserved. Missing/invalid/unavailable theme storage now follows System immediately as explicitly approved.
- Tests: Maven verify BUILD SUCCESS, 30 tests passed; npm ci:verify passed. Full Playwright run: 129 passed, two failures. Duplicate-name test raced server confirmation: logs proved second browser connected first, so added host-confirmation precondition without changing assertions. Topic guest startup timed out before cards/WebSocket initialization; no code change or definitive cause identified. Focused diagnostic run of collision/topic/preferences: all 12 passed (18.5s), retries=0. All nine new preference cases passed in both runs. No skipped tests or weakened assertions, no claim of a single all-green full-suite run.
- New findings: Baseline default discrepancy resolved by user decision. Storage-denied initialization no longer throws. Stale response and failed translation tests preserve latest selection and menu state. Existing collision test needed actual join confirmation rather than server-rendered name visibility.
- Effects on following stories: MR-006 may now replace language visuals using PPUI; MR-007/008 use existing setters/subscriptions. Do not move menu lifecycle into preferences.
- Open risks: One-off topic guest-start timeout remains unexplained, passed isolated diagnosis; historical suite flakiness and deferred topic editor defect remain separate. No Room/WebSocket/backend changes made to mask these.
- Local evidence: target/mr005-maven.log, mr005-browser.log, mr005-focused.log and associated result folders; initial baseline measurements retained.

### MR-006 — Redesign language controls

- ID: MR-006
- Title: Redesign language controls
- Goal: Present clear DE/EN controls.
- Scope: Desktop utility controls and mobile menu language controls without flags.
- Out of Scope: Translation content and language persistence semantics. All frozen functional contracts apply.
- Acceptance Criteria: Both layouts switch language with the same existing effect and synchronized state.
- Tests: DE/EN switching, reload, responsive controls and keyboard.
- Dependencies: MR-005
- Status: DONE
- Recommended Model: **Sol** — Mostly bounded visual/control adaptation on top of established PPUI behavior.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: Shared DE/EN text controls replace flags in desktop utilities and the mobile menu. The active language has a clear accent surface in both layouts.
- Resulting Decisions: Keep header-controls.js a thin PPUI adapter; preserve existing language persistence, events and dialog ownership.

#### Result

- Changed files: header-controls.html, header-controls.js, styles.css; app-header.html/head.html asset versions; lang-runtime-header.spec.ts; backlog/status documentation.
- Technical decision: Reuse PPUI and `aria-pressed`; do not introduce a language-state owner in the controls.
- Visual result: DE then EN replace flags; the selected language uses the accent surface and white text.
- Tests: Maven verify BUILD SUCCESS (30 passed); npm run ci:verify passed; 53 relevant Playwright tests passed for MR-006, followed by 23 focused header/language tests after strengthening the active state. Retries=0 and no skips.
- New findings: Existing selection state was functionally correct but insufficiently visible on light backgrounds.
- Effects on following stories: MR-007 may use the same PPUI subscription pattern for compact desktop theme controls.
- Open risks: Historical topic startup flakiness and deferred empty-topic defect remain outside this story. No game/backend/transport/storage changes.

#### Required MR-008 follow-up before MR-009

- Status: DONE (2026-10-13). Shared compact styling and monochrome theme icons; unchanged hamburger and all outer controls measure 40px.
- Visual contract: Language, Theme and Dev/Clean controls inside the hamburger menu must match the corresponding compact controls shown beside the hamburger on desktop. Apply the same minimalist container, button geometry, spacing and state treatment consistently.
- Height contract: The complete visible height of every compact preference control, including its outer border, must equal the current visible height of the hamburger button. The hamburger button is the reference and must not be resized to accommodate the other controls. Verify this equality at every breakpoint where the controls appear beside it.
- Selected state: Keep the normal foreground color of the active theme; inactive choices are approximately half-muted. Do not add an active fill, accent-colored button, underline or other menu-only selection treatment.
- Scope: Correct remaining menu-only visual differences if the comparison finds any. Do not change PPUI state, preference values, persistence, menu lifecycle or game behavior.
- Deferred validation: Run focused language/theme/ui-style interaction tests plus responsive visual comparisons in Dev/Clean and Light/Dark/System. Measure the preference-control and hamburger bounding-box heights at every relevant breakpoint and confirm exact equality. Confirm desktop header and hamburger-menu parity before marking this checkpoint complete.
- Validation completed: Build passed. 35 selected Playwright tests passed initially; one old inline-flex assertion was corrected to row arrangement (CSS flex-item blockification changes computed display). That keyboard test then passed. New bounding-box/style checks cover 320/375/768/769/1280px in Dev/Clean and Light/Dark/System, including OS theme changes. No skips/retries; functional assertions retained. Evidence: target/mr008-followup-*.log and tests/preference-parity.spec.ts.


### MR-007 — Redesign theme controls

- ID: MR-007
- Title: Redesign theme controls
- Goal: Modernize theme selection without changing its behavior.
- Scope: Compact desktop control; mobile Light/Dark/System menu choices.
- Out of Scope: Theme semantics or new preference values. All frozen functional contracts apply.
- Acceptance Criteria: All three modes persist and follow existing system-theme behavior.
- Tests: Light/Dark/System, system changes, reload, keyboard and mobile.
- Dependencies: MR-005, MR-006
- Status: DONE
- Recommended Model: **Sol** — Bounded theme-control presentation using established preference semantics.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: Desktop now exposes a compact Light/Dark/System control; mobile retains the labeled choices inside the settings menu. Both views reflect the same PPUI state.
- Resulting Decisions: `header-controls.js` is the thin view adapter for language and theme controls. PPUI remains the only theme preference owner; menu.js retains only menu lifecycle and other menu adapters.

#### Result

- Changed files: app-header.html, menu.html, head.html, header-controls.js, menu.js, styles.css, theme-runtime-menu.spec.ts, backlog/status documentation.
- Technical decision: Reuse the existing Light/Dark/System values, storage key and PPUI setter/subscription; expose no new preference or state owner.
- Visual result: Compact icon-only segmented theme control on desktop with accessible labels and clear selected state; labeled Light/Dark/System buttons remain in the mobile menu.
- Tests: Maven verify BUILD SUCCESS (30 passed); npm run ci:verify passed; 76 relevant Playwright tests passed in 2.2m with retries=0 and no skips. After the final SVG icon refinement, 24 focused theme/header tests passed in 25.5s.
- New findings: One shared `data-theme-mode` adapter keeps desktop and menu controls synchronized without menu lifecycle coupling.
- Effects on following stories: MR-008 can reuse the established preference-control pattern for Dev/Clean while preserving theme independence.
- Open risks: Historical topic startup flakiness and deferred empty-topic defect remain outside this story. No game/backend/transport/storage changes.


### MR-008 — Redesign Dev / Clean control

- ID: MR-008
- Title: Redesign Dev / Clean control
- Goal: Introduce a contemporary segmented style control.
- Scope: Dev/Clean presentation selector and synchronized selected state.
- Out of Scope: Style preference semantics or game state. All frozen functional contracts apply.
- Acceptance Criteria: Both choices work with existing storage and remain accessible and unambiguous.
- Tests: Keyboard selection, persistence, theme independence and responsive layout.
- Dependencies: MR-005, MR-007
- Status: DONE
- Recommended Model: **Sol** — Bounded Dev/Clean selector presentation using established preference semantics.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: Language, Theme and Dev/Clean now share one segmented-control treatment in the settings container. Selection remains synchronized through PPUI and keeps the established icons and labels.
- Resulting Decisions: Extend the thin header-controls preference adapter to all presentation selectors. PPUI remains the sole uiStyle owner; menu.js keeps no preference state.

#### Result

- Changed files: menu.html, app-header.html, head.html, header-controls.js, menu.js, styles.css, ui-style.spec.ts, backlog/status documentation.
- Technical decision: Reuse `pp-ui-style`, the existing Dev/Clean values and PPUI setter/subscription. The selector is a view only and introduces no state or persistence changes.
- Visual result: Language, Theme and Dev/Clean share the same container, height, spacing and selected-state treatment; only segment count and content differ.
- Tests: Maven verify BUILD SUCCESS (30 passed); npm run ci:verify passed; 55 relevant Playwright tests passed in 2.8m with retries=0 and no skips. Includes keyboard, persistence, blocked storage, theme independence, Desktop/Mobile and Chromium/Firefox geometry.
- New findings: The existing clean-mode choice styling required a scoped selector so the segmented selected state stays consistent across both UI styles.
- Effects on following stories: MR-009 can update functional toggles without touching presentation preference ownership.
- Open risks: Historical topic startup flakiness and deferred empty-topic defect remain outside this story. No game/backend/transport/storage changes.


### MR-009 — Redesign menu toggles

- ID: MR-009
- Title: Redesign menu toggles
- Goal: Modernize room-function toggle presentation.
- Scope: Auto-reveal, topic, specials, hard mode and existing menu toggles.
- Out of Scope: Events, payloads, permissions and host-only rules. All frozen functional contracts apply.
- Acceptance Criteria: All toggles preserve their exact functional effect and permission visibility; no duplicate dispatch.
- Tests: Menu guard, exactly-once toggles, host/guest permissions and affected room-flow tests.
- Dependencies: MR-004, MR-005, MR-008 including its required visual-parity follow-up
- Status: TODO
- Recommended Model: **Astra** — Exactly-once game-event dispatch, permissions and fragile toggle couplings are high-risk.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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
- Recommended Model: **Sol** — Information hierarchy and menu structure, with behavior frozen.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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
- Recommended Model: **Sol** — Brand/header visual integration; primarily presentation work.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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
- Recommended Model: **Sol** — Decorative Clean-mode surfaces; primarily CSS/presentation work.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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
- Recommended Model: **Sol** — Landing/join form visual redesign with existing form behavior preserved.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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
- Recommended Model: **Astra** — Room controls touch many frozen functional contracts and fragile DOM/event paths.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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
- Recommended Model: **Sol** — Responsive refinement of already implemented components.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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
- Recommended Model: **Astra** — Accessibility validation spans focus, keyboard, semantics and interaction lifecycle.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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
- Recommended Model: **Sol** — Cross-browser visual/geometry consistency with frozen functionality.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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
- Recommended Model: **Astra** — Final full regression validation across all frozen contracts and remaining risks.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
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

