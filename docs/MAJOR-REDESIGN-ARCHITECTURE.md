# MR-002: Target UI Architecture

Date: 2026-10-12. Source baseline: 3cf4d3d; application unchanged since 66d3caa.
Status: Architecture decision for later stories; no implementation in this commit.
Evidence: [MR-001 audit](MAJOR-REDESIGN-AUDIT.md).
All frozen contracts in [the backlog](MAJOR-REDESIGN-BACKLOG.md) remain binding.

## 1. Component boundaries

Retain Thymeleaf, vanilla JavaScript and the single styles.css. No framework, UI library, bundler or parallel page implementation.

| Component / intended home | Owns | Must not own |
| --- | --- | --- |
| New fragments/app-header.html | Semantic header, shared brand area, desktop utility cluster and one menu trigger | Room state or page-specific forms |
| Existing fragments/header-controls.html + header-controls.js | Language/theme presentation adapters calling the shared preference API | Storage writes, independent defaults, translation fetching |
| Existing fragments/menu.html + menu.js | One settings overlay, drawer/sheet lifecycle, settings view bindings and current menu event dispatch boundary | WebSocket, CID, game decisions |
| New static/js/ui-preferences.js (MR-005) | Theme, language, Dev/Clean resolution and synchronization; existing language translation application | Game state, topic draft, room permissions or transport |
| Existing storage.js | Safe storage access for existing keys | A second store, key migration or game state |
| Existing specials-bridge.js | Palette interactions and current event fences/order | Parent switch ownership or protocol changes |
| Existing room.js | Unchanged functional bridge and room rendering contracts | New preference storage or independent shell state |
| Existing page templates/head/footer/kbase | Page content, forms, SEO/head bootstrap, footer and knowledge content | Duplicated header/menu implementations |

app-header is a useful new composition boundary because branding and utility markup currently have no shared parent.
ui-preferences is a useful extraction boundary because menu/header currently duplicate preference writers.
After MR-006/MR-007, header-controls.js must be a thin view adapter only, or be integrated into the header component if useful; neither option may introduce a second state owner.
Create each only in its responsible story. Reuse existing files for all other responsibilities.

## 2. Shell and page composition

Target DOM order: shared head; app-header; one appMenu overlay; page main content; footer.
Header is in normal document flow, not fixed over content. Only the modal overlay is fixed.
The overlay is a sibling of header/main/footer so background interaction can be suspended without making the dialog inert.

app-header contains branding on the left and one utility cluster on the right.
Desktop utilities: DE/EN, compact theme control and menu.
Mobile header: branding and the same single menu trigger only.
Language/theme remain available in settings; desktop and mobile views have unique IDs and share state.
Existing hcLangEN/DE and themeLight/Dark/System IDs stay with their original controls; any additional views get distinct IDs/data bindings.
No duplicate IDs, no cloning of game controls, no moving a live game control between containers at a breakpoint.

Each page retains its existing content and meaningful H1; shared brand text is not another H1.
Final brandmark is MR-011. MR-003 must use existing branding/assets, not preempt it.
Keep public/room section conditions and page endpoints as they are. The existing unconditional participation row is not silently removed as an architectural cleanup.
No metadata, canonical, noindex, form fields, action URLs or invite behavior changes.

MR-003 establishes the composition and existing controls; MR-006/007 supply the final language/theme controls.
Until then retain functioning existing preference controls rather than creating temporary new behavior.

## 3. Settings lifecycle

Use one existing overlay/dialog node with responsive CSS, not separate desktop/mobile components.
menu.js is the sole lifecycle owner with idempotent open(), close(), isOpen().
menuOpen remains private transient component state owned exclusively by menu.js, including after MR-005. menu.js owns open/close/toggle, backdrop, Escape, focus entry/trap/return, scroll/background locking and ARIA/hidden state.
DOM attributes/classes are derived output, never an independently competing state source.

Opening: remember invoker, render visible state and ARIA atomically, emit existing document pp:menu-open exactly once on the closed-to-open transition, suspend background interaction/scroll and focus the in-dialog close button.
Closing: clear visible state, restore background/scroll and return focus to the invoker if still connected, otherwise menuButton.
Escape, backdrop, in-dialog close and existing trigger toggle use the same close operation.
Trap Tab/Shift+Tab among currently enabled, visible dialog controls; focus the panel when none exist.
Keep an accessible name via the settings heading and aria-labelledby; preserve aria-modal, aria-expanded and hidden/aria-hidden consistency.
A resize while open keeps one dialog and its current state/focus; no teardown/rebinding.
Keep the trigger toggle behavior, but provide an in-dialog close control so closing does not depend on an inert background trigger.
Restore any pre-existing inert/scroll state on close. Use classes/CSS for layout and scroll locking; no new inline styles.
Animations obey reduced motion and never delay functional state changes.

Desktop (>768px): right drawer, bounded width (initial target min(440px, available viewport)), vertically scrollable.
Mobile (<=768px): broad, near-fullscreen sheet with safe-area padding and an always-reachable close control.
Use dynamic viewport height with a fallback, not a fixed content height. Long settings content scrolls inside the dialog without hiding its last control.

## 4. Preference state and synchronization

One small frozen/public facade, proposed window.PPUI, exposes snapshot(), subscribe(listener), setTheme(mode), setLanguage(code), setUiStyle(style).
Snapshot fields: themeMode, language, uiStyle. Subscribers render controls; they do not write preferences back.
Only ui-preferences.js writes the preference root attributes/storage after MR-005.
The menu may consume preferences, but PPUI never owns or exposes menuOpen or a setMenuOpen API.
No cross-tab synchronization feature is added; existing reload behavior remains.
Keep window.setLanguage as a forwarding adapter where callers require it; remove the old writer in the same extraction.

| State | Persistence / output | Rules |
| --- | --- | --- |
| Theme | planningpoker-theme; html data-theme | light/dark/system; system removes the attribute and lets existing media-query CSS resolve color |
| UI style | pp-ui-style; html data-ui-style | dev/clean; preserve Dev fallback |
| Language | lang; html.lang and existing message application | de/en; retain normalization, existing endpoint/cookie behavior and runtime events |


Initialization must happen before CSS for theme/style and before preference adapters for runtime subscriptions.
Extract existing early bootstrap responsibilities into the synchronous preference module when MR-005 lands, rather than adding a later competing initialization.
PPStorage loads first. DOM-dependent translation/control binding waits until parsing is complete.
Translation loading belongs to the preference module after extraction; preserve text, attribute and dynamic interpolation handling.
Use a request generation token so a stale language response cannot overwrite the most recently requested language.
Maintain window pp:lang-change and document pp:lang-changed contracts and existing room language observer until a separately validated presentation-only adaptation is needed. Do not add another event bus.

### Existing default discrepancy: migration gate (resolved for MR-005)

The audited head uses dark when no saved theme exists, while header initialization can resolve system. The language paths also use different precedence.
MR-002 originally required a scoped decision. On 2026-10-12 the user approved System as the default from initial bootstrap, including unavailable storage. Valid saved Light/Dark/System values remain unchanged; Dev is the style fallback; denied storage uses in-memory state. Language retains saved-value then rendered-locale precedence.
The completed characterization is recorded in MAJOR-REDESIGN-PREFERENCES-BASELINE.md. Original gate: before MR-005 extraction, characterize current first-paint and settled behavior for missing/invalid storage, blocked storage, system light/dark, server locale and lang query parameters.
Use that observed behavior as the acceptance fixture; preserve saved values and existing visible outcomes.
If a single bootstrap rule would change an outcome, record the specific conflict and stop for a scoped decision instead of silently selecting a new default.
This is a defined compatibility gate, not permission to retain duplicate writers in the final architecture.

## 5. Frozen game boundary and selector migration

Presentation preference setters never send room commands.
Retain room.js state reconciliation, WebSocket lifecycle/payloads, host checks, identity, preflight, persistence and all room endpoints.
Do not move topic edit state, specials selection, participation, hard mode or sequence into PPUI just because their controls appear inside settings.

Preserve the audit event map exactly, including event targets and detail keys.
menu.js remains the owner of existing switch dispatch; preserve __bound coordination with room fallback wiring.
Programmatic rendering must not synthesize change/input events.
Sequence controls are especially sensitive: preserve checked-state reconciliation and existing sequence/seq/setSequence fan-out.
Do not remove room observers or compatibility payloads under a UI cleanup label.

| Contract group | Migration rule |
| --- | --- |
| menuButton/appMenuOverlay | Move the trigger into shared header without duplicating it; overlay stays unique |
| menu*Toggle and menuSeqChoice/input[name=menu-seq] | Keep existing IDs/names and live nodes through shell/container stories |
| rowSpecialsPick/.spc[data-id] | Preserve palette nesting/event fences and order until MR-009 validates pointer and keyboard behavior |
| cardGrid/liveParticipantList/topicRow/resultRow | Do not touch in header/settings stories; MR-014 maps rendering/delegation before changing markup |
| revealButton/resetButton and window handlers | Preserve action/permission effects; no new parallel click dispatcher |
| body.is-host and visibility mirrors | Remain derived from existing room state; never become an authorization source |

Any required selector replacement must update renderer, delegated listener, CSS and test helper together in the owning story.
Functional assertions stay intact. Removing a row-action workaround requires evidence its effect survives; it is not assumed safe.
Current inline layout writers may only be moved into CSS within the story owning that component, with geometry/behavior checks.

## 6. CSS and responsive strategy

All new styling stays in styles.css using existing theme tokens and data-ui-style variants.
Organize touched rules into shell, settings, controls and page-specific sections; consolidate only the affected rules.
Use component classes for presentation and retain IDs for functional contracts.
Avoid new !important escalation. Remove an old override only when its effective result is preserved by the owning story.
No palette/brand finalization in MR-002.

Canonical new shell breakpoint: mobile <=768px, desktop >768px, matching existing room mobile logic.
Do not globally rewrite older content breakpoints; MR-015 checks their interaction.
Validate 320, 375, 768, 769 and 1280px, long German labels, landscape, zoom and keyboard-visible mobile viewport.
Use fluid widths, min-width:0 where needed, wrapping and safe-area insets.
Dev/Clean share structure and geometry contracts; decoration does not intercept pointer events or alter DOM order.
Retain current footer behavior for now. MR-013/015 must verify full page scrolling and last-content visibility before any footer/layout restructuring.

## 7. Script ownership and incremental delivery

- Head remains the only owner of storage/pre-paint initialization.
- app-header composes markup; do not load a script once per control.
- Initially retain menu fragment ownership of menu.js/specials-bridge.js and header fragment ownership of header-controls.js, each exactly once.
- Preserve deferred order: menu, specials bridge, header adapter, room connector. Async work must not be relied on as a load-order guarantee.
- Do not newly include fragments/scripts.html alongside the menu-owned bridge.
- MR-005 adds the one synchronous preference module after storage and removes replaced bootstrap/writer code in the same commit.
- Every story leaves a working page; no inactive second application, duplicate state owner or feature-flagged redesign branch inside runtime code.

## 8. Story handoff and validation gates

| Story | Architectural obligation / evidence |
| --- | --- |
| MR-003 | Shared header, one trigger, page headings intact; test all four page types and mobile/desktop navigation |
| MR-004 | One drawer/sheet lifecycle; open/close/overlay/Escape, focus entry/trap/return, resize and scroll tests |
| MR-005 | Single preference owner, characterized defaults, blocked storage, early paint, language race handling, reload and state synchronization |
| MR-006/007/008 | Adapters only; DE/EN, Light/Dark/System and Dev/Clean controls agree without new writers |
| MR-009/010 | Existing event and permission boundary; exactly-once toggles plus real pointer and keyboard palette tests; prescribed section order |
| MR-011/012 | Brand/decorative layers only; light/dark, reduced motion, no pointer interception |
| MR-013/014 | Preserve forms, invite/room flows, renderer selectors and all frozen game effects |
| MR-015/016/017 | Boundary widths, unclipped content, focus/ARIA/contrast/touch, Chromium/Firefox theme/style matrix |
| MR-018 | Full relevant functional regression, documented coverage gaps, no skips/retries/weaker assertions to mask failures |

Frozen-contract coverage: room creation/join/invite remain page/backend contracts; participant/host/transfer/permissions remain room/backend contracts; vote/reveal/reset/sequence/specials/auto-reveal/hard-mode/spectator/topic remain existing room effects; protocol/payload/identity/persistence remain untouched. No architecture component claims their ownership.

MR-002 validation: review against each MR-001 coupling and frozen contract; verify docs-only diff and repository whitespace checks.
No runtime code or tests changed, so the previously green Maven/Playwright baseline is not rerun for this document.
Outstanding implementation risks: default-precedence characterization, palette hit-testing, old inline layout writers, partial focus coverage, production flakes and deferred topic bug.
No story beyond MR-002 is started.