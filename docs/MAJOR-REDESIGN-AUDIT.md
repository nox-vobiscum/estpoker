# MR-001: UI Architecture Audit

Date: 2026-10-12. Inspected source: 0f9a4a1 (application baseline 66d3caa).
Scope: read-only source/test audit, not a target architecture or visual implementation.
README.md was read first, followed by BRIEFING.md and the epic backlog/status.
References below are repository-relative; line numbers describe the audited revision.

## Composition and loading

| Owner | Current responsibility and anchors |
| --- | --- |
| templates/index.html:3, invite.html:3, about.html:3, room.html:3 | Shared head, menu, header-controls and footer fragments; no common semantic header shell. Branding is inside page content (index/room app-title). Public pages disable sequence/room menu sections; participation section is unconditional. |
| templates/fragments/head.html:98 | Synchronous storage.js, inline early theme/style bootstrap, then styles.css. Preserve pre-paint ordering and SEO metadata/noindex. |
| templates/fragments/menu.html:1,227,263 | Owns menu button/overlay/settings markup, inline topic visibility bridge, deferred menu.js and specials-bridge.js. showAuto is a fragment argument but auto-reveal markup sits inside showRoom. |
| templates/fragments/header-controls.html:1,39 | Separate language flag buttons and deferred header-controls.js. Both languages currently available across breakpoints. |
| templates/fragments/scripts.html:7 | Also declares specials-bridge.js; no current page replacement reference found. Do not introduce duplicate loading when composing a future shell. |
| templates/room.html:113 | Deferred room.js receives participant/room via script data attributes. Earlier deferred scripts execute first; menu async initialization can overlap room bootstrap. |
| templates/index.html:17,64; invite.html:47 | Join form POST /join, participantName/roomCode and hidden flags; landing inline validation and invite-name-check.js are functional boundaries, not decorative controls. |
| templates/fragments/kbase.html:59 | Separate inline knowledge-content behavior; retain independently of voting rendering. |

Paths in this table are under src/main/resources/.

## State owners and flows

1. Theme: PPStorage.theme() reads planningpoker-theme; head bootstrap applies data-theme before CSS. menu.js applyTheme writes preference, attribute and pressed states; header-controls.js applies theme again at initialization. Head fallback is dark, header fallback system. This is an observed precedence discrepancy, not a demonstrated visual failure.
2. Dev/Clean: PPStorage.uiStyle() reads pp-ui-style. Head applies data-ui-style before CSS; menu.js applyUiStyle normalizes and writes it and button states. Separate from color theme.
3. Language: server-rendered locale, html.lang, localStorage.lang, menu MSG, header fallback translation map and room MSG coexist. Header setLang delegates to window.setLanguage (menu), else requests /i18n and /i18n/messages. It emits window pp:lang-change and document pp:lang-changed. room.js:2308 also observes html lang and rerenders. Preserve the two different event targets; asynchronous duplicate work/racing updates are a risk to investigate, not a proven bug here.
4. Menu: menu.js openMenu/closeMenu owns hidden class, hidden attribute, aria-hidden, aria-expanded, button glyph/labels. Opening emits document pp:menu-open; room.js:1613 resynchronizes controls. Closing focuses menuButton; Escape/backdrop close are wired. No focus trap or explicit focus-on-open found in these handlers. aria-modal alone is not a focus-management implementation.
5. Room: room.js owns mixed transport, identity, authoritative-server state reconciliation, optimistic state and DOM rendering. connectWS/handleMessage/applyVoteUpdate (377/501/573) lead into participant/card/topic/result rendering and menu synchronization. body.is-host is a presentation mirror observed by menu and specials scripts, not the permission authority.
6. Identity/persistence: storage.js is a safe read helper, not a unified preference store. room.js:139 uses session pp-cid; flash, preflight and presence keys are separate functional concerns. These must not enter the UI preference redesign.
7. Topic editing: room.js:1237-1445 maintains draft/edit state and delegates actions while rebuilding DOM; the menu fragment separately manipulates visibility. The known empty-topic close defect remains deferred, not diagnosed or fixed here.

## UI event contract map

Sources: menu.js wireSwitchRow/initSequenceTooltips; specials-bridge.js dispatchSet;
consumers: room.js:1885-1971.

| Document event | Detail | Current effect |
| --- | --- | --- |
| pp:auto-reveal-toggle | {on} | Host guard, send autoReveal:boolean. |
| pp:topic-toggle | {on} | Host guard, local visibility/edit handling, send topicVisible:boolean. |
| pp:participation-toggle | {estimating} | Local spectator/participant rendering and vote clearing, send participation:boolean. |
| pp:specials-toggle | {on} | Palette bridge reacts; room rereads checkbox in a microtask and sends specials:boolean. Do not replace this with a second dispatcher. |
| pp:specials-set | {ids} | Ordered/canonical IDs, optimistic deck rebuild, send encoded specials:set payload and request sync. |
| pp:hard-mode-toggle | {on} | Host guard, local hardMode and card/menu rendering in this handler; do not invent a new server payload. |
| pp:sequence-change | {id} | Normalize sequence, optimistic reset/deck change and notifySequence. Existing sequence/seq/setSequence payload fan-out is frozen. |
| pp:close-room | none | Host guard, one confirmation, closeRoom send. |
| pp:menu-open | none | Room controls resync. |
| pp:topic:set | {visible} | Emitted by inline fragment visibility bridge; distinct from pp:topic-toggle. |

Header language events: window pp:lang-change and document pp:lang-changed carry {lang, source:'header'}.
Inline room reveal/reset handlers depend on window.revealCards/window.resetRoom (room.js:1684).
This map records existing effects; no payload or compatibility behavior may be simplified in a visual story.

## Fragile couplings and consequences

| Finding / source | Risk | Stories / required evidence |
| --- | --- | --- |
| menu.js wireSwitchRow + room.js:1624 share element.__bound ownership | Replacing controls/rebinding can duplicate or lose dispatch. | MR-002/004/009: explicit ownership and exactly-once tests. |
| room.js:1775-1883 root/document change/input listeners, MutationObserver and DOM sequence reconciliation | A supposedly visual checked-state update may become a game command. | MR-002/005/009: preserve reconciliation and payload fan-out; sequence host/guest/reset tests. |
| specials-bridge.js capture/bubble fences and body.is-host observers; menu.js parent-row click | Changing nesting can toggle parent and palette together, or intercept clicks. Existing tests even use keyboard to avoid interception. | MR-004/009/014: pointer and keyboard, host/guest and specials payload tests. |
| menu.js forceRowLayout and label styles; room.js dynamic participant/topic markup and row-action hotfixes (2412,2504) | CSS-only changes may lose to inline styles; moving nodes breaks delegated selectors and mobile observers. | MR-002/010/014/015: catalog selectors and presentation writers before moving nodes. |
| Visibility uses hidden, is-hidden, style.display and ARIA; menu and room both reflect toggles | Incomplete updates can leave painted state and accessibility state inconsistent. | MR-004/005/009/016: define ownership in MR-002; verify both DOM and functional state. |
| Multiple preference/i18n writers with different fallbacks and unguarded localStorage access in menu/header | Bootstrap/runtime divergence and restricted-storage initialization risks. | MR-005/006/007: existing values, pre-paint behavior, failure paths and reload tests. |
| menu overlay dialog declares aria-modal but lacks observed focus containment/initial focus | Keyboard can remain outside an apparently modal container. | MR-004/016: explicit focus-entry, Tab containment, Escape and focus-return acceptance tests. |
| styles.css layered overrides, !important and mixed 560/600/640/768/769 breakpoints; room.js uses 768 | New shell can disagree with participant/menu mobile layout. | MR-002/015/017: define responsive strategy later; inspect breakpoint boundaries, not only nominal widths. |
| styles.css:493 fixed footer, public page overrides at 907 and later footer rules at 996 | Reading only early rules gives incorrect effective-layout conclusions; prior landing clipping can regress. | MR-013/015: scroll to last content on home/about/invite/room. |
| IDs and data attributes span scripts, CSS and tests | Renaming/moving DOM requires coordinated UI adapters and selectors, never weaker functional assertions. | MR-003 onward: preserve contracts or map replacements explicitly. |

Critical selectors include menuButton/appMenuOverlay, menuSeqChoice + input[name=menu-seq], menu*Toggle,
rowSpecialsPick/.spc[data-id], hcLangEN/DE, themeLight/Dark/System, uiStyleDev/Clean,
liveParticipantList/.participant-row, cardGrid, topicRow/topicDisplay/.topic-actions,
revealButton/resetButton and resultRow/resultAnnounce.
Rendering, labels, enabled state and event delegation all depend on them.

## Test trace and coverage limits

- scripts/check-menu-toggle-events.js statically checks three event/payload/listener contracts; it does not prove runtime dispatch count or all menu controls.
- tests/toggles.spec.ts asserts exactly one auto-reveal/topic/participation event. Retain these assertions.
- tests/menu-smoke.spec.ts covers button/backdrop and ARIA/checkbox consistency; uses forced clicks and may try a toggle twice. It is not proof of pointer hit-testing or a complete dialog keyboard contract.
- tests/specials-ui.spec.ts explicitly uses keyboard to avoid pointer interception. A green run alone does not settle that known pointer risk.
- tests/menu-sequence.spec.ts, sequence-change.spec.ts, specials-payload.spec.ts, specials-stats.spec.ts and prod-deck.spec.ts cover relevant deck contracts.
- tests/lang-runtime-header.spec.ts, lang-runtime.spec.ts, i18n-switch.spec.ts, theme-runtime-menu.spec.ts, storage.spec.ts and ui-style.spec.ts cover preference/language/style behavior.
- tests/control-geometry.spec.ts compares Chromium/Firefox across styles, themes and widths; not a full accessibility or screenshot review.
- Room regression anchors: rebrand-core-flow, cards-reveal, auto-reveal, reset-flow, participation-spectator, host-and-close, kick-flow, reload-stays-in-room, reconnect-state, topic-flow, topic-visibility-toggle and result-aria-* specs.
- No dedicated complete dialog focus-trap/Escape/focus-return test found in the inspected menu tests. Plan it for MR-004/016; do not claim existing coverage.
- The initialization baseline was 30 Maven and 95 Playwright passing without runner retries/skips. Internal helper retries/conditional branches still limit what that proves.
- This audit changes documentation only. No new browser run or Maven rebuild is necessary to validate unchanged application code; npm ci:verify and documentation-only diff checks are the current-run checks.

## Decisions and handoff to MR-002

No target architecture is selected here. MR-002 must decide shell composition, one preference synchronization owner, menu lifecycle/focus ownership, responsive boundaries and a migration map for the selectors/events above. Keep transport, CID, room-state reconciliation, permission checks and payload encoding behind an unchanged functional boundary. A monolithic room.js is not permission for gameplay refactoring.

MR-003/004 must account for fragment load order and existing public-page menu differences.
MR-005 must explicitly reconcile current bootstrap defaults without silently changing preference semantics.
MR-009/014 must preserve delegation fences, state echo and event count.
MR-016/018 must report coverage gaps rather than treating a green baseline as exhaustive proof.

Documentation drift: README/BRIEFING describe Java 25 and proxy/CDN deployment at a high level; this audit does not verify runtime/hosting claims or modify those documents. Actual source, not historical comments, is the evidence for UI ownership above.

No UI, backend, tests, configuration, dependencies or infrastructure changed. Stop after this story.