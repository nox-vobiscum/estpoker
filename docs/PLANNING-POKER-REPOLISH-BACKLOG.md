# Planning Poker — Repolish Epic Backlog

Status: **PLANNED** · Target: current single-interface (former Clean) design · Scope: **presentation only**

## Reference and precedence

- Visual reference: `Planning-Poker-Interface_REFERENCE_MOCKUP.png` (user-approved three-view mockup: desktop host, desktop guest, mobile). It is versioned beside this backlog for the duration of the epic.
- **Precedence:** existing working product behavior, permissions and states > explicit contracts below > mockup illustration. The mockup combines illustrative, sometimes mutually inconsistent states. **It is not a functional specification.** In particular, host-only buttons accidentally visible in guest/mobile mockups must **not** be implemented as shown.
- Preserve the established **full-width app header without a surrounding page frame**; only the actual room content has a bounded centered width. Mobile header: **brand + one hamburger only**; language/theme controls stay in the menu. Header styling from current production is the reference, not an opportunity to reinvent it.
- Preserve the RBS brand asset exactly. No new logo, icons from an unrelated family, glow, neon background, accent borders, or new gradients.
- Preserve current **voting card/chip sizes, sequence, wrapping, selection and value-dependent colors** (green → yellow/orange → red), **result chip colors and conditional behavior**, and the 🎉 on consensus. Do not recolor active cards blue. Preserve reveal/new-round button sizing and host-only sticky behavior (including scroll clearance); do not stretch it to desktop content width.
- Keep the existing collapsed `Anleitung & Funktionen` component (content/operation unchanged) and existing Leave Room behavior. Do not reintroduce redundant room FAQ/marketing text.
- Visual direction: near-black neutral charcoal canvas; quiet, minimalist surfaces; consistent radius/height/outline/focus tokens; restrained monochrome icons. Uppercase, small, uniformly styled meta labels `DU BIST`, `RAUM`, `SCHÄTZTHEMA`, `TEILNEHMENDE` (plus count). Preserve existing i18n and its translations.

## Non-negotiable functional freeze

Do **not** change room lifecycle, creation/join/invite, room code/name/CID, host election/transfer, participant roster/status, spectator mode, vote/reveal/reset, auto-reveal, hard mode, specials, sequences, topic content/visibility/edit/delete, menu/theme/language behavior, storage, routes, FTPS, backend, WebSocket messages/payloads, permissions, event bindings, selectors relied on by scripts, or accessibility semantics. No new dev/clean dual mode. Avoid reshuffling DOM nodes with existing event ownership unless audited and proven safe. No new CSS framework, inline styling, duplicate overrides or unrelated refactors.

**Role matrix (must be verified for every affected story):**

| Operation | Host | Guest | Spectator |
|---|---|---|---|
| View room, participants, topic | yes | yes | yes |
| Vote | current established rules | current established rules | **no vote** |
| Reveal / new round / change host settings | existing host-only behavior | **no** | **no** |
| Edit / clear topic | existing host-only behavior | **no** | **no** |
| Participant actions: make host, toggle spectator, kick | only authorized host, on eligible **other** participants | **no trigger, no popup, no action** | **no trigger, no popup, no action** |
| Leave room | yes (self only) | yes | yes |
| Close room for everyone | host only, via existing menu | **no** | **no** |

Do not infer permission from a mockup. Preserve server-side authorization; merely hiding controls is insufficient. When the current actual functional rule is more nuanced, **audit and document it, preserve it, ask before changing it**. Host transfer and host leaving require explicit characterization. On host change, action UI must update promptly without stale privileges.

## Mandatory start / stop gate — EACH ticket

1. Read `README.md`, `docs/BRIEFING.md`, this backlog, current status/handoff and the relevant previous ticket result; check branch, HEAD, working tree, recent commits and production/baseline differences. Confirm exact files/selectors touched and current behavior. Never assume repository paths from this document.
2. Propose the least expensive **appropriate** model for this ticket; model changes cannot be performed autonomously. **WAIT for explicit user approval of model and ticket** before implementing. If a session is interrupted, repeat the gate before resuming. Do not begin next ticket automatically.
3. Set ticket **IN PROGRESS**. Make **one bounded change** using existing tokens/components and preserve all frozen behaviors. If unexpected functionality/backend/security changes are necessary: **STOP, report, request approval**. No opportunistic fixes.
4. Run **only focused tests relevant to changed selectors/behaviors** plus the smallest build/sanity step strictly required to validate them. Prefer existing targeted Playwright specs or geometry assertions; do **not** run entire Maven/E2E suites, comprehensive cross-browser grids or huge screenshot sweeps by default. Never disable, weaken or skip an existing failing relevant test. Clearly state which tests **were not run**; deferred full regression is not equivalent to passing it. Security/permission checks are mandatory when touching host-actions.
5. Test minimal representative geometry: desktop ~1280px and narrow mobile 320/375px; add 768/769px **only when the change touches responsive layout/breakpoint behavior**. Test keyboard/focus and Light/Dark/System only as relevant; ensure no horizontal overflow, clipping, obstructing overlays or lost focus.
6. Update this ticket's Result, backlog/status/handoff (files, CSS tokens, behavior preserved, tests, screenshots/findings, known risks). Commit **only this ticket** separately; working tree clean; STOP. If remaining quota becomes low (~20%), checkpoint rather than starting more work.

## RP-000 — Baseline & selector map

- **Status:** DONE · **Model:** GPT-5.6 Sol
- **Goal:** Read-only inventory before visual edits.
- **Tasks:** Compare current single-interface production/refactor baseline to design image. Map header, metadata, topic, participant rows, role/status icons, vote chip, action buttons, result panel, manual and responsive CSS owners; record JS-coupled selectors/IDs, transform and sticky interactions, actual menu permission rules. Identify reusable tokens and existing tests. Capture lightweight current-state screenshots (desktop/mobile host + guest) only if needed.
- **Acceptance:** Explicit baseline commit/tag/branch; list of safe CSS/markup touch points and uncertain items; no product changes.
- **Tests:** None; read-only audit.
- **Result:** Baseline `03a3622` is protected by annotated tag `pre-interface-repolish`; work continues on `feature/interface-repolish`. The selector, ownership, role, token, focused-test and risk inventory is recorded in `PLANNING-POKER-REPOLISH-BASELINE.md`. No product files or behavior changed and no tests were required. The approved target order is topic before participants whenever the topic is enabled and visible, with no empty topic placeholder when disabled.

## RP-001 — Room metadata & typographic hierarchy

- **Status:** DONE · **Model:** GPT-5.6 Sol
- **Goal:** Quiet compact room information with consistent small uppercase labels.
- **Tasks:** Keep existing full-width header and production controls exactly as-is. Within centered room content, refine `DU BIST` and `RAUM` into compact, one-line-preferred groups, keep small person/room icons and copy-link control; align `SCHÄTZTHEMA` and `TEILNEHMENDE` label styles via shared token. Handle long user names/codes: flex min-width 0, wrap or truncation with accessible full value; copy-link must remain tappable. Never force a single line at all viewport widths.
- **Acceptance:** Header unchanged; labels uniform; no clipping, horizontal scroll, hidden room name/link or mobile overlap. Real i18n strings intact.
- **Tests:** Targeted room metadata + 320/375/768/769/1280 geometry; long-name/code edge cases.
- **Result:** `room.html` now groups the existing semantic metadata pairs without changing `#youName`, `#roomCodeVal` or `#copyRoomLink`. Local `.main-info*` rules provide a restrained shared surface, uppercase meta labels, safe ellipsis and a two-column layout from 375px upward; 320px stacks the groups to protect long values and the existing mobile copy target. The new `--ui-meta-label-*` tokens align metadata, topic and participant labels while existing theme/surface/radius/shadow tokens provide both color schemes; `styles.css` cache version is 79. Validation passed: TypeScript build check, Maven package with tests skipped, 7 focused metadata cases (320/375/768/769/1280 plus Light/System), 3 existing mobile-content cases and the existing participant-list identity case. No full Maven, Playwright, cross-browser or screenshot suite was run; no known RP-001 risk remains.

## RP-002 — Topic panel emphasis (presentation only)

- **Status:** DONE · **Model:** GPT-5.6 Sol
- **Goal:** Distinguish the estimation topic from participant rows without creating a giant headline.
- **Tasks:** Dedicated restrained topic surface, positioned before the participant heading/list whenever enabled and visible, with no reserved placeholder when disabled. Use modest border separation, small uppercase `SCHÄTZTHEMA` label and a medium-weight readable title (not hero-sized); align existing host edit/clear actions right with shared compact button geometry. Preserve optional URL, empty/hidden states, long multiline titles, role-based permissions, IDs and existing handlers. No accidental host buttons for guests/spectators, regardless of illustrative mockup.
- **Acceptance:** Topic visibly identifiable; no hero styling, no new highlight color; host editing works; guest/spectator cannot access topic edit/clear; long topics flow on mobile.
- **Tests:** Focused topic state/permissions + desktop/mobile layout only.
- **Result:** The unchanged `#topicRow` now precedes the participant heading/list whenever enabled and collapses completely when disabled. Its existing IDs, inline editor, ticket link, delegated handlers, WebSocket contracts and permission checks remain intact. Local topic CSS uses the shared meta-label and surface tokens for a restrained raised panel, quieter icon, modest title and right-aligned existing controls; `styles.css` cache version is 80. Validation passed: TypeScript build check, Maven package with tests skipped, 7 focused topic panel/flow/visibility cases at 375/1280px in Light/Dark/System, plus a final 3-case topic-flow run after adding real Guest-to-Spectator permission coverage. Host edit/save/cancel/clear, long wrapping, optional URL, hidden-state collapse and guest/spectator action absence passed. No full Maven, Playwright, cross-browser or screenshot suite was run; no known RP-002 risk remains.

## RP-003 — Participant list visual hierarchy

- **Status:** DONE · **Model:** GPT-5.6 Sol
- **Goal:** Calm three-zone participant rows while preserving vote centering and all role states.
- **Tasks:** Heading `TEILNEHMENDE` + live existing count; modest shared container/row separators, names left, **vote chips geometrically centered on the participant row / shared vertical axis** (avoid previous animation-transform drift), action zone right reserved for eligible host controls. Small monochrome host crown immediately beside host name; spectator eye and inactive zzz icon next to respective names **without textual status labels**; preserve accessible label/tooltips and disconnected styling. Do not invent generic avatars, initials, new voting colors or extra emphasis.
- **Acceptance:** Row and vote alignment consistent at 320px and desktop; names wrap/truncate gracefully; host/spectator/inactive distinguishable without extra written labels; no vote chip resizing or recoloring.
- **Tests:** Focused participant/status/geometry incl. after reveal/reset and end of animations; role presentation checks.
- **Result:** Participant rows now use one restrained shared surface with row separators and three stable zones: identity left, vote/status exactly on the row center axis, and the unchanged eligible-host actions right. The existing silhouette remains neutral; a small monochrome crown, spectator marker or inactive `zzz` sits beside the safely truncated name with screen-reader text and tooltips. Spectators retain a neutral centered vote placeholder, while vote-chip dimensions, colors, animation, participant state and action contracts remain unchanged. The former strong host-row fill was removed because the inline crown now carries that hierarchy. Cache versions are `styles.css?v=81` and `room.js?v=60`. Validation passed: TypeScript/guard checks, Maven package with tests skipped, and 12 focused Chromium cases covering 320/375/1280px, live count, spectator transitions, disconnect/inactive presentation, long names, no horizontal overflow, heartbeat/reconnect, and chip centering before/during/after reveal and reset. No full regression or cross-browser suite was run; no known RP-003 risk remains.

## RP-004 — Host participant-actions overflow menu

- **Status:** DONE · **Model:** GPT-6 Astra (approved, including action-handler consolidation and spectator-toggle correction)
- **Goal:** Collect **existing** host-actions under a single compact `…` trigger per eligible participant, with clearly labeled actions.
- **Tasks:** Before coding, audit existing permissions, IDs, handlers, host transfer, spectator toggle and kick, including self-row restrictions. Use existing JS actions/event contracts; no new commands. Show trigger **only to authorized host, only on eligible target rows**. Popup shows descriptive, localized entries: `Zum Host machen`, `Zum Zuschauer machen` / reverse when applicable, `Aus dem Raum entfernen`, with appropriate existing confirmation rules. Proper touch/click/keyboard activation, Esc/outside-click/selection close, focus return, menu repositioning/overflow on mobile and last row. Guest/spectator must never see/access triggers or items; role switches update UI without stale menus. Differentiate Leave Room and Close For Everyone.
- **Acceptance:** Exact preexisting action semantics; no duplicate handler calls; no unauthorized options or self-actions; no popup clipped by row container; robust for mouse/touch/keyboard/mobile and changing host.
- **Tests:** **Required focused security/role matrix:** host, guest, spectator, own row, transfer, spectator toggle and restore, kick, mobile popup/focus, reconnect/re-render; do not run unrelated suite. If these focused tests cannot establish permission safety: STOP (do not claim DONE).
- **Result:** A single localized three-dot menu replaces desktop action links and cloned mobile buttons. Native button clicks are the sole execution path for mouse, touch, Enter and Space; competing pointer/capture handlers and mobile clone synchronization were removed with explicit approval. Spectator toggling now sends the existing `setSpectator:<name>:<boolean>` command exactly once in either direction. Host-transfer/kick commands and confirmations remain intact. Both rendering and execution require an authorized, participating host and an eligible other participant; guests, spectators (including a host who opts out), self targets and stale menus cannot invoke these controls. Server authorization remains unchanged. Escape/Tab/outside interaction close the menu; arrow/Home/End keys navigate it; focus returns appropriately; rerenders discard stale menus; the popup opens upward when required. DE/EN labels and existing tokens are reused; cache versions are CSS 82 / room JS 61. Validation: 14 focused Chromium tests passed, followed by five final menu-layout cases after obsolete mobile-action CSS removal and correction of the test's language/theme setup. Coverage includes outbound command counts, cancelled/accepted transfer and kick, spectator round trips, guest/spectator/self denial, direct non-host server-command rejection, reconnect/rerender, keyboard/touch and 320/375/768/769/1280px geometry. JavaScript syntax, TypeScript and diff checks pass. Final Dark-mobile/Light-desktop screenshots were inspected. No Maven/full regression/cross-browser suite or deployment. Existing RP-003 presentation issues are recorded in the baseline handoff for RP-006.

## RP-005 — Results, voting, actions & guide: preservation/polish

- **Status:** DONE · **Model:** GPT-5.6 Sol
- **Goal:** Harmonize section spacing without changing established core gameplay UI.
- **Tasks:** Preserve existing result states: hidden before reveal/reset; 🎉 + green consensus chip only when consensus; average/median/range only when non-consensus reveal (special-card handling unchanged). Preserve result and vote-chip colors, sizes, sequence, selected states and centering. Preserve compact desktop reveal/new-round button and current mobile sticky host behavior including safe scroll clearance; guest/spectator should not receive host actions. Keep bottom Leave Room button available to all roles and closed-by-default `Anleitung & Funktionen` below action area; **reuse the current production guide component** and its look, not the mockup's unboxed text. Adjust only local spacing/consistency if demonstrably needed.
- **Acceptance:** No appearance/behavior regression to result or voting chips; action never obscures last voting row; guide and leave remain discoverable; no extra colors/effects.
- **Tests:** Focused unrevealed/revealed/consensus/non-consensus/reset/host-vs-guest mobile layout and sticky clearance.
- **Result:** The established result, cards, vote-chip colors/sizes/order, host button geometry, mobile fixed action, guide component and leave control remain unchanged. The only product styling adjustment reduces the rigid desktop gap before the existing collapsed guide from `5.25rem` to `3rem`, bringing it into the room section rhythm; the original `5.25rem` is retained at `≤600px` as clearance for the fixed host action. CSS cache version is 83. A 19-case focused baseline passed before the change. Afterward, 10 existing focused Chromium cases confirmed consensus/statistics center alignment at 375/1280px and guide behavior at 320/375/768/1280px; two new cases confirmed hidden/revealed/consensus/non-consensus/reset states, compact host-only controls, guest denial, guide/leave availability and mobile ability to scroll the final voting row, guide and leave control clear of the fixed action/footer. TypeScript and diff checks pass. No Maven/full regression/cross-browser suite or deployment.

## RP-006 — Responsive & accessible presentation verification

- **Status:** DONE · **Model:** GPT-5.6 Sol
- **Goal:** Finish small-screen behavior without changing desktop or functional contracts.
- **Tasks:** Inspect at 320/375/768/769/1280 px; ensure mobile **only brand + hamburger** in header, language/theme are available through existing menu; room metadata adapts for long strings, topic multiline, participant actions popup stays within viewport, touch targets/focus outlines work, sticky action does not occlude cards, no outer page frame or horizontal overflow. Check long names, inactive/spectator, two users, many users, host and guest/spectator. Restrict fixes to proven presentation issues; if functional impact suspected STOP.
- **Acceptance:** No overlap/cutoff; accessible controls; intended full-width header on desktop; no accidental host controls in any non-host state.
- **Tests:** Focused responsive geometry/keyboard/role screenshots (not complete project suite); report remaining known gaps.
- **Result:** Responsive presentation was verified across the established 320/375/768/769/1280px breakpoints and dense host/guest/spectator/inactive roster states. Two inherited RP-003 issues were corrected locally: the explicit Light-theme host-row fill is now neutral like every other theme, and the mobile identity zone reserves sufficient space before the geometrically centered vote chip so long names and role markers cannot collide with it. Header controls, room metadata, topic wrapping, participant actions, mobile sticky action clearance, guide and leave controls retain their existing behavior; CSS cache version is 84. TypeScript and 26 focused Chromium cases pass, including keyboard/permission coverage, popup containment, long values, five-participant rooms and horizontal-overflow checks. Dark/Light behavior is covered by the targeted specs and final Light mobile/desktop screenshots were inspected. No Maven, full regression or cross-browser suite was run; no known RP-006 presentation gap remains.

## RP-007 — Epic verification, decision & handoff

- **Status:** TODO · **Model:** GPT-5.6 Sol (suggested)
- **Goal:** Verify bounded work, document residual risk and prepare release separately.
- **Tasks:** Review diff against RP-000 baseline and frozen contracts; check no unexpected i18n/JS/backend/CSS legacy changes, no unused duplicate rules, compare actual current UI to approved reference on host/guest/mobile. Summarize each ticket and focused test results; identify if any broader regression run is outstanding. **Do not deploy or merge without a separate user-approved release instruction.**
- **Tests:** Reuse targeted tests already run; only run additional narrowly scoped checks for uncovered changed behavior. Full regression is a separate release decision.
- **Acceptance:** All tickets documented; known risks and tests not run made explicit; per-story commits and clean working tree; user sign-off requested.
- **Result:** Pending.

## Story execution summary

Recommended order: **RP-000 → RP-001 → RP-002 → RP-003 → RP-004 → RP-005 → RP-006 → RP-007**. One ticket per approved run; separate commit; stop at each checkpoint. RP-004 is the only deliberately interaction-heavy ticket. The design mockup is authoritative **for presentation only**. Existing functionality and permission semantics are authoritative **for behavior**.

### Minimal prompt to start the epic

> Read `README.md`, `docs/BRIEFING.md`, current status/handoff and `PLANNING-POKER-REPOLISH-BACKLOG.md`, then perform **only the Mandatory Start Gate for RP-000**. Check branch/HEAD/working tree and confirm that `Planning-Poker-Interface_REFERENCE_MOCKUP.png` is available as a visual reference. Propose model and plan, then **WAIT for my explicit approval**. Do not implement other tickets or run a full test suite.
