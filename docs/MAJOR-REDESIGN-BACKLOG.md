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

Modernize the complete visual UI and presentation architecture of RBS' Planning Poker while preserving every existing functional effect. MR-001 through MR-010 and MR-012 through MR-015 completed; MR-011 awaits header visuals.

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
MR-001 is DONE following explicit approval on 2026-10-12. MR-002 through MR-010 and MR-012 through MR-015 are DONE; MR-011 is deferred, MR-016 through MR-018 are TODO.
Stop and report an unclean baseline. Never manufacture green tests through skips, retries or weaker assertions. Intentional DOM changes may require selector updates while retaining functional assertions.
After architecture changes additionally verify menu open/close, state synchronization, exactly-once toggles, mobile collapse, focus/Escape/overlay. MR-018 runs the full relevant suite.
Keep each run bounded to analysis, one story, or its validation. When available usage budget falls below roughly 20%, start no new story; write a handoff and stop. Usage quota is not exposed to this run.
Completed story results are recorded below; later story results remain placeholders.

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


#### Required MR-008 follow-up before MR-009

- Status: DONE (2026-10-13). Shared compact styling and monochrome theme icons; unchanged hamburger and all outer controls measure 40px.
- Visual contract: Language, Theme and Dev/Clean controls inside the hamburger menu must match the corresponding compact controls shown beside the hamburger on desktop. Apply the same minimalist container, button geometry, spacing and state treatment consistently.
- Height contract: The complete visible height of every compact preference control, including its outer border, must equal the current visible height of the hamburger button. The hamburger button is the reference and must not be resized to accommodate the other controls. Verify this equality at every breakpoint where the controls appear beside it.
- Selected state: Keep the normal foreground color of the active theme; inactive choices are approximately half-muted. Do not add an active fill, accent-colored button, underline or other menu-only selection treatment.
- Scope: Correct remaining menu-only visual differences if the comparison finds any. Do not change PPUI state, preference values, persistence, menu lifecycle or game behavior.
- Deferred validation: Run focused language/theme/ui-style interaction tests plus responsive visual comparisons in Dev/Clean and Light/Dark/System. Measure the preference-control and hamburger bounding-box heights at every relevant breakpoint and confirm exact equality. Confirm desktop header and hamburger-menu parity before marking this checkpoint complete.
- Validation completed: Build passed. 35 selected Playwright tests passed initially; one old inline-flex assertion was corrected to row arrangement (CSS flex-item blockification changes computed display). That keyboard test then passed. New bounding-box/style checks cover 320/375/768/769/1280px in Dev/Clean and Light/Dark/System, including OS theme changes. No skips/retries; functional assertions retained. Evidence: target/mr008-followup-*.log and tests/preference-parity.spec.ts.

### MR-009 — Redesign menu toggles

- ID: MR-009
- Title: Redesign menu toggles
- Goal: Modernize room-function toggle presentation.
- Scope: Auto-reveal, topic, specials, hard mode and existing menu toggles.
- Out of Scope: Events, payloads, permissions and host-only rules. All frozen functional contracts apply.
- Acceptance Criteria: All toggles preserve their exact functional effect and permission visibility; no duplicate dispatch.
- Tests: Menu guard, exactly-once toggles, host/guest permissions and affected room-flow tests.
- Dependencies: MR-004, MR-005, MR-008 including its required visual-parity follow-up
- Status: DONE
- Recommended Model: **Astra** — Exactly-once game-event dispatch, permissions and fragile toggle couplings are high-risk.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: Dark/system-dark lacked off-track tokens; nowrap labels crowded switches on narrow screens; a late thumb offset and generic input focus rule conflicted with switch styling.
- Resulting Decisions: CSS-only presentation change. Preserve native inputs, IDs, listeners, payloads, permissions and lifecycle. All five switches use flat rows, stacked wrapping label/status text, a centered white thumb and explicit keyboard focus. Reduced motion disables switch transitions.

#### Result

- Changed files: src/main/resources/static/styles.css, src/main/resources/templates/fragments/head.html, tests/menu-toggle-presentation.spec.ts, docs/MAJOR-REDESIGN-BACKLOG.md, docs/MAJOR-REDESIGN-STATUS.md.
- Technical decision: Reuse existing theme variables and switch markup. Remove conflicting Clean row surfaces and obsolete thumb override; normalize shared preference button appearance across engines. No application JavaScript or backend changes.
- Visual result: Consistent minimal switch rows in Dev/Clean and both themes; status below label, visible off/on states, clear focus and disabled presentation, no label/track overlap at 320px.
- Tests: Maven verify: 30 passed, zero skips. npm run ci:verify passed. 14 existing targeted Playwright cases passed (events, drawer lifecycle, auto-reveal, participation, topic visibility, specials and hard-mode/host transfer). New tests initially exposed the focus-rule collision; after correction, all 12 selected final cases passed (4 Chromium/Firefox switch/permission cases, 2 cross-engine geometry cases, 6 preference-parity cases), retries=0, no skips. Final package build and CI guards passed. No full-suite rerun.
- New findings: Native keyboard Space and large-row pointer actions each dispatch exactly one unchanged event/payload; guests retain four disabled host switches and their enabled personal participation control. Existing hard mode remains client-local by design.
- Effects on following stories: MR-010 can adjust section hierarchy while retaining these controls and their contracts. Await separate user approval.
- Open risks: Existing topic startup flakiness and empty-topic editor defect remain out of scope. Evidence: target/mr009-*.log, target/mr009-*.png, test-results/menu-toggle-presentation-*/switches.png (ignored local artifacts).


### MR-010 — Redesign menu sections and hierarchy

- ID: MR-010
- Title: Redesign menu sections and hierarchy
- Goal: Organize settings into a clear hierarchy.
- Scope: Language, theme, Dev/Clean, sequence, room functions, personal functions, secondary actions, in that order.
- Out of Scope: Changing setting behavior or availability. All frozen functional contracts apply.
- Acceptance Criteria: Order and grouping are clear on desktop/mobile; existing functions remain reachable.
- Tests: Menu reachability, host/guest visibility, keyboard order and mobile scrolling.
- Dependencies: MR-009
- Status: DONE
- Recommended Model: **Sol** — Information hierarchy and menu structure, with behavior frozen.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: The existing control order already matched the target. What was missing was visible grouping, a mobile language heading, a named secondary-action section and semantic section labels.
- Resulting Decisions: Keep all controls and their DOM order. Reuse existing menu-section wrappers, translation keys and styles.css; add one translated secondary-action label. Use section headings and subtle dividers without touching JS or room behavior.

#### Result

- Changed files: src/main/resources/templates/fragments/menu.html, src/main/resources/static/styles.css, src/main/resources/templates/fragments/head.html, src/main/resources/messages.properties, src/main/resources/messages_de.properties, tests/menu-hierarchy.spec.ts, docs/MAJOR-REDESIGN-BACKLOG.md, docs/MAJOR-REDESIGN-STATUS.md.
- Technical decision: Add role=group and aria-labelledby to each existing section; headings are h4 below the dialog h3. Keep existing control IDs, event listeners, feature flags and visibility conditions.
- Visual result: Mobile Language heading, section dividers before sequence/room/personal/secondary groups, and a localized More actions heading above Close room. Existing colors and controls retained.
- Tests: Maven verify: 30 passed, zero skips. npm run ci:verify passed. 21 targeted Playwright cases passed without retries or skips, covering section order at 320/768/1280px, keyboard order, mobile scrolling, public page visibility, host/guest permissions, menu lifecycle, language/theme and exactly-once toggle events. Manual desktop/mobile screenshot inspection completed. No full suite.
- New findings: Public pages render only language/theme/style/personal groups; room-only groups stay absent there. The last action remains reachable through keyboard navigation and scrolling on narrow screens.
- Effects on following stories: MR-011 can build the brand header without changing menu section ownership. Await explicit user approval.
- Open risks: Existing topic startup flakiness and empty-topic editor defect remain outside this story. Evidence: target/mr010-*.log and test-results/menu-hierarchy-*/menu-sections.png (ignored local artifacts).


### MR-011 — Introduce new brand header visual

- ID: MR-011
- Title: Introduce new brand header visual
- Goal: Establish the final Planning Poker brand identity consistently across the in-app header, PWA installation assets and browser favicons.
- Scope:
  - Integrate the final supplied brand asset package.
  - Use the supplied three-card `RBS` brandmark as the primary in-app / header mark.
  - Keep the visible product name `Planning Poker` as HTML text beside the brandmark.
  - Do not embed the product wordmark inside image assets.
  - Use the supplied PWA icons for installable-app assets.
  - Use the supplied simplified three-card `R` mark for favicon usage.
  - Support Light and Dark themes using the same coherent asset family.
  - Replace obsolete legacy logo/favicon references where safe.
  - Update asset references, manifest entries and favicon metadata as required by the existing application structure.
  - Preserve the existing responsive header shell and utility controls.
- Brand Asset Package:
  - Input package: `assets-incoming/planning-poker-brand-assets-originaltreu.zip` (removed locally after verified transfer; separately backed up by the user)
  - The package contains:
    - transparent `RBS` header/brandmark PNGs in multiple sizes
    - primary PWA icons in 192x192, 512x512 and 1024x1024
    - Apple touch icon
    - favicon PNG fallbacks
    - multi-size `favicon.ico`
    - no SVG: the supplied R mark is available as ICO and PNG only
    - asset manifest and integration notes
- Visual Contract:
  - Three portrait-format cards with intentionally slightly irregular overlap/spacing.
  - The cards must not be rearranged into a mechanically even fan.
  - Primary brandmark uses `RBS`.
  - Favicon uses the reduced three-card mark with `R`.
  - Palette: elegant navy / steel / white.
  - Keep the overall appearance restrained, modern and professional.
  - No bright multicolor card treatment.
  - No `PP` abbreviation.
  - No graphical `Planning Poker` wordmark.
  - Avoid excessive glow, 3D effects or decorative animation.
- Header Contract:
  - Visible header identity:
    - supplied `RBS` brandmark
    - HTML text `Planning Poker`
  - Remove the visible `RBS' Planning Poker` wording where the new brandmark already provides the RBS signature.
  - The page/product name should therefore visually read as:
    - `[RBS card mark] Planning Poker`
  - Keep the brandmark decorative with appropriate accessible naming on the containing brand link; avoid redundant screen-reader repetition.
  - Preserve the existing single shared app-header fragment.
  - Do not introduce a second header implementation.
  - Desktop utility controls remain unchanged functionally.
  - Mobile continues to expose only branding plus the existing menu trigger.
- Asset Integration:
  - Inspect the existing Spring Boot static-resource layout first.
  - Place the supplied files into the most appropriate existing static asset directories rather than inventing parallel structures unnecessarily.
  - Rename assets only if required by the existing project conventions.
  - Update all relevant references consistently:
    - shared app header
    - page title/logo instances
    - favicon metadata
    - PWA manifest
    - Apple touch icon
    - social/metadata image references only if they currently depend on the old icon and replacement is appropriate
  - Prefer responsive image sizing through CSS/HTML dimensions; do not distort the source aspect ratio.
  - Keep high-resolution sources available for HiDPI displays.
- Out of Scope:
  - No product rename.
  - No infrastructure or domain changes.
  - No gameplay changes.
  - No WebSocket changes.
  - No preference/state changes.
  - No menu lifecycle changes.
  - No new UI framework.
  - No redesign of language/theme/menu controls.
  - No changes to frozen functional contracts.
- Accessibility:
  - Brand link retains a meaningful accessible name.
  - Decorative image content must not produce duplicate spoken branding.
  - Header remains keyboard-navigable.
  - Brandmark contrast remains visually sufficient in Light and Dark modes.
  - No text should be rasterized solely for accessibility-relevant product naming.
- Acceptance Criteria:
  - Header displays the final three-card `RBS` mark beside HTML text `Planning Poker`.
  - Legacy visible `RBS' Planning Poker` presentation is replaced consistently where appropriate.
  - Brandmark renders cleanly in Light and Dark themes.
  - Brandmark remains legible and unclipped at narrow widths.
  - Mobile header retains the established branding + single-menu-trigger contract.
  - PWA manifest references the supplied 192x192 and 512x512 icons.
  - Maskable PWA assets are correctly referenced if the manifest supports purpose-specific icons.
  - Apple touch icon is wired correctly.
  - Browser favicon uses the simplified three-card `R` identity with SVG/ICO/PNG fallbacks as appropriate.
  - No obsolete competing favicon/logo reference remains active unintentionally.
  - No asset includes a graphical `Planning Poker` wordmark.
  - No frozen gameplay or state contract changes.
- Tests:
  - Verify header rendering in:
    - Light Dev
    - Dark Dev
    - Light Clean
    - Dark Clean
    - System theme
  - Verify desktop and mobile at:
    - 320px
    - 375px
    - 768px
    - 769px
    - 1280px
  - Verify:
    - no header overflow
    - no distorted logo aspect ratio
    - no duplicate visible branding
    - keyboard navigation
    - accessible brand naming
    - favicon references resolve successfully
    - PWA icon files resolve successfully
    - manifest icon metadata is valid
  - Run relevant existing header, responsive, SEO/metadata and navigation Playwright tests.
  - Run Maven verify and npm CI guards.
  - Retries=0; do not weaken existing assertions.
- Dependencies:
  - MR-003
  - MR-010
  - Recheck MR-012 Clean surfaces against the final brand visual.
- Status: DONE
- Scheduling: Completed after the Mandatory Story Start Gate and explicit user approval.
- Notes / Findings:
  - MR-012 was completed ahead of this story with About content surfaces only.
  - Final brand decision:
    - primary/header/PWA identity = three-card `RBS` mark
    - favicon identity = simplified three-card `R` mark
    - visible product name remains HTML text `Planning Poker`
    - palette = elegant navy / steel / white
    - no `PP` abbreviation
    - no graphical wordmark
- Recommended Model: **GPT-5.6 Sol** — bounded visual asset integration using the established shared header architecture.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Resulting Decisions:
  - Use the supplied asset package as the source of truth for MR-011.
  - Keep `Planning Poker` as HTML text, never baked into the logo asset.
  - Use `RBS` for primary brand identity and `R` only for the reduced favicon identity.

#### Result

- Changed files: Shared header and head fragments; Home, About, Invite and Room headings; both message bundles; manifest, stylesheet, original image assets, SEO and asset tests; this backlog and redesign status.
- Technical decision: Use only byte-identical PNG/ICO files from `planning-poker-brand-assets-originaltreu.zip`. The supplied RBS mark is used for header, page headings, PWA, Apple and social image; the supplied R mark is used only for favicon. The package has no SVG or maskable-safe icon, so remove the obsolete SVG reference and declare PWA icons with `purpose: any`.
- Visual result: The shared header shows the RBS card mark beside HTML text `Planning Poker`; About, Invite and Room headings also retain it. A follow-up removed the redundant centered mark/title from Home and promoted its existing explanatory heading to H1. Desktop/mobile controls and functionality remain unchanged. Obsolete competing favicon files and the temporary incoming-asset directory were removed.
- Tests: Full isolated Maven verify passed (30 tests, zero skips); npm CI guards and TypeScript check passed. 37 focused header, language, SEO and asset Playwright cases passed; seven brand cases including System theme passed after correcting a test assertion made while the menu dialog hid background content. No retries or skipped cases. Asset SHA-256 hashes match the approved ZIP.
- New findings: The normal Maven repackage was blocked by an existing lock on `target`; an isolated source copy completed the full verify. The provided asset documentation explicitly forbids SVG recreation and false `maskable` declarations.
- Effects on following stories: MR-016, MR-017 and MR-018 can validate the integrated final brand assets.
- Open risks: Favicon appearance at very small sizes and OS-specific PWA/Apple backgrounds should receive manual visual review; the source graphics must remain unchanged.


### MR-012 — Introduce Clean-mode decorative surfaces

- ID: MR-012
- Title: Introduce Clean-mode decorative surfaces
- Goal: Differentiate Clean visually through subtle surfaces.
- Scope: Subtle cards/surfaces in Clean; Dev remains technical, reduced and without equivalent decoration.
- Out of Scope: Functional changes and shared game state. All frozen functional contracts apply.
- Acceptance Criteria: Modes are visibly distinct while content remains legible and unobstructed.
- Tests: Theme/style matrix, contrast, reduced motion and responsive overflow.
- Dependencies: MR-008. MR-011 is deferred by user decision; this story excludes the header and must be reviewed against the brand visual when MR-011 resumes.
- Status: DONE
- Recommended Model: **Sol** — Decorative Clean-mode surfaces; primarily CSS/presentation work.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: Existing Clean styles already cover menu, landing explainer and room controls. The About sections were the remaining plain content surfaces. The new cards use the same Clean palette and shadow tokens; Dev remains unchanged.
- Resulting Decisions: Add only passive About intro/section surfaces and readable intro text. Keep the header out of scope pending MR-011 and leave forms, room controls and all functional state unchanged.

#### Result

- Changed files: src/main/resources/static/styles.css, src/main/resources/templates/fragments/head.html, tests/clean-surfaces.spec.ts, docs/MAJOR-REDESIGN-BACKLOG.md, docs/MAJOR-REDESIGN-STATUS.md.
- Technical decision: CSS-only About surfaces using existing Clean tokens and a subtle intro gradient. No new asset, layout mode, script or game-state change.
- Visual result: Intro and explanatory sections use soft cards in Clean Light/Dark/System; Dev keeps its plain sections. Desktop/mobile full-page screenshots inspected.
- Tests: Maven verify 30 passed; npm run ci:verify passed. All 25 existing ui-style Playwright tests passed. The first run of the new contrast tests misread Chromium color(srgb) values; after fixing that test parser, all 6 new surface tests passed without retries/skips. They cover 375/1280px, theme/style matrix, color contrast, reduced motion and overflow. No full suite.
- New findings: Browser computed colors can use color(srgb) rather than rgb(0-255); the contrast test now handles both. System-theme surfaces respond to OS color changes without reload.
- Effects on following stories: MR-013 can proceed on the form independently. MR-011 remains open for later brand visuals; recheck its integration with Clean About surfaces.
- Open risks: Existing topic startup flakiness and empty-topic editor defect remain separate. MR-011 brand/header acceptance criteria have not been validated. Evidence: target/mr012-*.log and test-results/clean-surfaces-*/{light,dark}-about.png (ignored local artifacts).


### MR-013 — Redesign landing/join form

- ID: MR-013
- Title: Redesign landing/join form
- Goal: Modernize form controls and hierarchy.
- Scope: Inputs, labels, CTA and visual hierarchy.
- Out of Scope: Submit, validation, room creation, join or invite behavior. All frozen functional contracts apply.
- Acceptance Criteria: Same data and actions produce the same result; labels and errors remain accessible.
- Tests: Create/join/invite, invalid input, keyboard submission and mobile layout.
- Dependencies: MR-012
- Status: DONE
- Recommended Model: **Sol** — Landing/join form visual redesign with existing form behavior preserved.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: The home and invite forms already share the same structure and labels. Their JavaScript and submit paths required no changes.
- Resulting Decisions: Scope the form layout to landing pages; use existing Clean surface tokens and keep Dev styling plain.

#### Result

- Changed files: `src/main/resources/static/styles.css`, `src/main/resources/templates/fragments/head.html`, `tests/landing-form.spec.ts`, this backlog and `docs/MAJOR-REDESIGN-STATUS.md`.
- Technical decision: CSS-only presentation update with scoped rules for both landing forms; no changes to form fields, names, routes, validation or JavaScript.
- Visual result: Left-aligned labels, aligned input and CTA widths, consistent touch targets and a subtle Clean form surface. Dev stays unadorned.
- Tests: Maven verify 30 passed; npm CI guards passed; 31 existing focused Playwright tests and 2 new landing-form tests passed. The new tests cover validation, Enter submission, labels and 320px layout.
- New findings: None.
- Effects on following stories: MR-014 can start after separate approval; MR-011 remains deferred for header visuals.
- Open risks: Existing unrelated baseline risks remain.


### MR-014 — Redesign room controls

- ID: MR-014
- Title: Redesign room controls
- Goal: Visually unify room presentation.
- Scope: Voting cards, buttons, participant rows, topic UI and statistics.
- Out of Scope: Any game mechanics or fixes to deferred functional defects. All frozen functional contracts apply.
- Acceptance Criteria: Controls retain their exact effects, permissions and state rendering.
- Tests: Voting/reveal/reset, sequences, specials, host transfer, spectator, topic and stats contracts.
- Dependencies: MR-009, MR-013
- Status: DONE
- Recommended Model: **Astra** — Room controls touch many frozen functional contracts and fragile DOM/event paths.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: Started after explicit user confirmation of the Astra switch. Room rendering and delegated events depend on existing selectors; no markup or JavaScript changes are needed.
- Resulting Decisions: Refine existing CSS rules for cards, participant spacing, topic surfaces, result values and host buttons. Preserve grids, visibility, disabled states and mobile sticky actions.

#### Result

- Changed files: `src/main/resources/static/styles.css`, `src/main/resources/templates/fragments/head.html`, `tests/specials-stats.spec.ts`, this backlog and `docs/MAJOR-REDESIGN-STATUS.md`.
- Technical decision: Update existing CSS only; keep room DOM, JS, event delegation, permissions and rendering states intact. Bump the stylesheet cache version.
- Visual result: Consistent card height, restrained selected-card ring without scale shifts, theme-aware hover borders, balanced participant/topic spacing, clearer statistic values and aligned host-action styling.
- Tests: Maven verify 30 passed; npm CI guards and final TypeScript check passed. 35 focused Playwright cases passed across the initial and follow-up runs: style matrix, voting/reveal/reset, sequence, specials/statistics, spectator, topic, host transfer and mobile/desktop Chromium/Firefox geometry. No skips or automatic retries.
- New findings: The initial specials/statistics test revealed before checking that every vote had reached the host. Replaced its forced coffee click with an actionable click and explicit server-rendered vote acknowledgements; the corrected test passed. Application logic is unchanged.
- Effects on following stories: MR-015 responsive refinement is next (Sol); MR-011 remains deferred for header visuals.
- Open risks: Existing topic editor defect remains deferred. Sticky footer/action placement and broader responsive refinement belong to MR-015.


### MR-015 — Responsive mobile refinement

- ID: MR-015
- Title: Responsive mobile refinement
- Goal: Refine all new components for small screens.
- Scope: Single mobile menu entry point, touch-friendly controls and scrollable settings.
- Out of Scope: New features and game logic. All frozen functional contracts apply.
- Acceptance Criteria: Small screens have no clipped content, blocked controls or duplicate entry points.
- Tests: Narrow/mobile viewports, orientation, footer/content visibility and settings scrolling.
- Dependencies: MR-014
- Status: DONE
- Recommended Model: **Sol** — Responsive refinement of already implemented components.
- Story Start Protocol: Before starting this MR, re-read `README.md`, `docs/BRIEFING.md`, `docs/MAJOR-REDESIGN-BACKLOG.md` and `docs/MAJOR-REDESIGN-STATUS.md`. Confirm the active branch, the last completed MR and the frozen functional contracts. Report the recommended model below. If another model is currently selected, propose switching first and WAIT for explicit user confirmation. Only after confirmation may implementation begin; continue this MR through validation, documentation, DONE, its separate commit and status update, then STOP.
- Notes / Findings: Started on the user's Sol confirmation. The existing header already shows one mobile menu trigger, and the settings sheet scrolls to its final control. A long room code could hide the copy control on narrow screens.
- Resulting Decisions: Keep the shared header and settings lifecycle. Scope small-screen touch targets and room-code truncation to the room page; preserve the compact footer and existing sticky action placement.

#### Result

- Changed files: `src/main/resources/templates/room.html`, `src/main/resources/static/styles.css`, `src/main/resources/templates/fragments/head.html`, `tests/mobile-content-visibility.spec.ts`, this backlog and `docs/MAJOR-REDESIGN-STATUS.md`.
- Technical decision: Add a room-page class for scoped CSS. No JavaScript, routes or game behavior changed. The stylesheet cache version was bumped.
- Visual result: The copy action stays visible next to an ellipsized long room code; small room/topic/special/participant actions have 40px touch targets. The single mobile menu entry and scrollable settings remain intact.
- Tests: Maven verify 30 passed; npm CI guards and final TypeScript check passed. 30 mobile/header/settings cases passed after correcting a test timing assumption, plus 3 topic/spectator cases passed. Portrait 320/375px and landscape 667px layouts, footer/content separation, menu reachability and copy-control hit testing were checked without retries or skips.
- New findings: A full-page screenshot placed fixed controls over later content, but viewport-end geometry confirmed the footer and last block remain reachable. The first mobile test measured before room rendering finished; it now waits for the rendered room and scroll endpoint.
- Effects on following stories: MR-016 accessibility pass is next (Astra); MR-011 still awaits header visuals.
- Open risks: The known empty-topic editor defect remains outside this visual story.


## Required visual polish follow-up before MR-016 — Shape language consistency

- Status: DONE
- Recommended Model: **GPT-5.6 Sol** — bounded presentation-system cleanup; no gameplay or state changes.
- Goal: Make the redesigned UI feel intentional and coherent by reducing the currently inconsistent corner-radius, control-height and surface-shape vocabulary.
- Scope: Audit and normalize the shape language of visible interactive controls and surfaces, especially:
  - desktop DE/EN segmented control
  - desktop Light/Dark/System segmented control
  - hamburger/menu trigger
  - settings close button
  - menu preference controls
  - primary CTA buttons such as Join
  - text inputs
  - settings drawer/sheet and major cards/panels
- Design Direction: Use a small, explicit radius system instead of ad-hoc per-component values. Prefer at most three levels:
  - **small** for compact segmented controls and similar small controls
  - **medium** for normal buttons, icon buttons and inputs
  - **large** for cards, panels and drawer/sheet surfaces
  A practical target is approximately **10px / 14px / 20px**, but preserve current proportions if a nearby token value produces a cleaner migration. The important contract is a consistent three-level system, not arbitrary one-off radii.
- Shape-family contract:
  - language and theme segmented controls must share the same outer radius, height, border treatment and internal segment geometry
  - hamburger/menu trigger and settings close button must belong to the same icon-button family: same size, radius, border language, focus treatment and visual weight
  - normal CTA buttons and inputs should share the same medium-radius design language unless a documented accessibility/layout reason requires otherwise
  - large cards/panels/drawer surfaces may use the large radius, but should not introduce additional unrelated radii
- Visual-system audit: Record the current `border-radius`, visible control height, border width/style, shadow treatment and focus-ring treatment for the affected components before changing them. Remove obsolete or conflicting one-off overrides where safe.
- CSS architecture: Prefer shared CSS custom properties/tokens for the radius levels and reuse them consistently. Do not introduce inline styles or a new UI library.
- Out of Scope: Any change to PPUI state, preference semantics, menu lifecycle, event listeners, game events/payloads, room logic, permissions, persistence, backend, WebSocket behavior, routes or form semantics. All frozen functional contracts remain unchanged.
- Acceptance Criteria:
  - no more than three intentional radius levels are used for the audited control/surface families
  - related controls visibly belong to the same component family
  - hamburger and settings close button have matching geometry and shape language
  - language/theme preference controls retain the existing compact parity contract
  - CTA/input/card/panel rounding looks systematic rather than ad hoc
  - keyboard focus remains clearly visible and is not clipped by the new radii
  - Dev/Clean and Light/Dark/System remain visually distinct and fully usable
  - no layout regressions or clipped controls at 320/375/768/769/1280px
- Tests / Validation:
  - run Maven verify and npm CI guards
  - run focused Playwright tests for header, settings container, preference parity, landing form and responsive layout
  - add or extend geometry assertions for the audited control families where useful
  - compare Dev/Clean in Light/Dark/System on desktop and mobile
  - inspect Chromium and Firefox for border-radius, focus-ring and control-height consistency
  - retries=0; do not weaken existing functional assertions
- Result Recording: Document changed files, chosen radius tokens/values, any intentionally retained exception, screenshots/geometry evidence, test results and downstream risks in this backlog and `docs/MAJOR-REDESIGN-STATUS.md`.
- Completion Gate: Finish this follow-up before MR-016 so accessibility, cross-browser and final regression validate the polished shape system rather than an intermediate one.

#### Audit and result

- Pre-change computed audit (desktop, Chromium, Light; radii Dev/Clean): DE/EN and Light/Dark/System outer controls 10/12px at 40px height; their menu counterparts matched. Hamburger 12/16px at 40px; settings close 8/8px at 44px. Join button 12/14px and name input 10/12px, both 48px high. Clean join panel 22px; Dev join form had no panel. Desktop drawer 0/22px, mobile sheet 16/22px. Controls used 1px solid borders except the borderless CTA. The compact controls, hamburger, form CTA and drawer had shadows; the desktop close button had none. Keyboard focus used a 2px accent outline with 2px offset, while text inputs used a 3px focus shadow.
- Chosen shape tokens: `--shape-radius-small: 10px` for compact segments; `--shape-radius-medium: 14px` for input, CTA, icon actions, row cards and smaller content cards; `--shape-radius-large: 20px` for panels and mobile sheets. Existing `--ui-*radius` variables now map to these shared values. Dev/Clean still differ through typography, palette and shadows.
- Intentional exceptions: the desktop drawer is square where it meets the viewport edge; the Dev landing form is an unboxed layout. Switch tracks/knobs remain pill/circle shapes because their geometry conveys switch state. Logos and decorative flags are not part of the control-radius system.
- Changed files: `src/main/resources/static/styles.css`, `src/main/resources/templates/fragments/head.html`, `tests/shape-language.spec.ts`, this backlog and `docs/MAJOR-REDESIGN-STATUS.md`.
- Visual result: Header language/theme outer controls and menu preferences share one compact family. Hamburger and settings close now match at 40px with the same radius, border, surface, shadow and keyboard outline. CTA and text input share the medium radius. Major Clean panels use the large radius; smaller cards use the medium radius.
- Validation: Maven verify 30 passed; npm CI guards passed. Twelve cross-browser shape cases covered Dev/Clean, Light/Dark/System, 375/1280px, Chromium/Firefox and focus rings. Forty-four existing header, settings, preference, landing, mobile and Clean-surface cases passed. Fourteen final shape/topic cases passed after removing redundant overrides. Six final room geometry, participant and special-control checks passed after the last radius alignment. No retries or skips.
- Evidence: baseline computed values above; final values from `node target/shape-audit.cjs`; shape screenshots in `test-results/shape-language-*/`, including mobile Chromium and desktop Firefox. Generated artifacts are local and ignored by Git.
- Downstream risk: MR-016 should review touch-target requirements independently, especially the 40px header/close family preserved from the earlier header-height decision. No functional contract or behavior changed.

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

