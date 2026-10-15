# Planning Poker interface repolish baseline

Status: **RP-000 complete**  
Baseline commit: `03a3622`  
Checkpoint: `pre-interface-repolish`  
Working branch: `feature/interface-repolish`

This document maps the current production interface before the presentation-only
repolish. Existing behavior, permissions and accessibility semantics take
precedence over the reference mockup.

## Visual reference

The versioned reference is
`docs/Planning-Poker-Interface_REFERENCE_MOCKUP.png`. It illustrates hierarchy,
density and surface treatment for a desktop host, desktop guest and a narrow
mobile view. It is not a state or permission specification.

The current full-width header, its production controls and the RBS brand asset
remain unchanged. The room content stays within the centered `.container`.
The card deck, result semantics, host-only actions, guide and room-exit behavior
remain governed by the current application.

## Theme and token baseline

`src/main/resources/static/styles.css` owns the complete presentation. Dark is
defined in the base `:root`; explicit Light uses `:root[data-theme="light"]`;
System Light mirrors the same values in
`@media (prefers-color-scheme: light)` when no explicit theme attribute exists.

Reusable semantic tokens include:

- canvas and text: `--bg`, `--text`, `--text-strong`, `--text-dim`;
- surfaces: `--panel`, `--panel-2`, `--panel-hover`, `--ui-surface`,
  `--ui-surface-raised`, `--ui-surface-border`;
- meaning and interaction: `--accent`, `--ok`, `--warn`, `--danger`,
  `--field-focus`;
- geometry: `--shape-radius-*`, `--ui-*-radius`, `--gap`, `--gap-sm`,
  `--vote-chip-width`;
- elevation: `--ui-shadow-sm`, `--ui-shadow-md`, `--ui-shadow-lg`.

Light mode must preserve the same semantic hierarchy rather than invert Dark:
canvas is the quietest layer, grouped content uses a subtle surface, the topic
uses a clearer boundary, and vote/result colors retain their meaning. System
must be checked once with each operating-system color scheme whenever a ticket
changes theme-sensitive tokens.

## Ownership and safe touch points

| Area | Markup / render owner | Presentation owner | Coupled contracts |
|---|---|---|---|
| Header | `fragments/app-header.html`, `header-controls.js` | `.app-header`, `.app-brand`, `.app-utilities` | Mobile exposes brand and `#appMenuButton` only; do not change in this epic. |
| Room metadata | `room.html` | `.main-info`, `.mi-*`, `.room-with-actions` | `#youName`, `#roomCodeVal`, `#copyRoomLink` are used by room identity/copy behavior and tests. |
| Participant heading | `room.html`, count updated by `renderParticipants()` | `.participant-heading`, `.participant-count` | `#participantCount` is visual only (`aria-hidden`) and counts rendered rows. |
| Participants | `room.js::renderParticipants()` | `#liveParticipantList`, `.participant-row`, `.participant-icon`, `.name`, `.row-right` | `#liveParticipantList`, row classes and `data-action`/`data-name` are event and test contracts. |
| Participant status / vote | `room.js::renderParticipants()` | `.mini-chip`, `.vote-chip`, `.heat`, `.outlier`, `.disconnected`, `.spectator` | Vote animation uses `transform`; desktop centering uses independent `translate`. Preserve this separation. |
| Participant actions | `room.js` | `.row-action`, `.row-actions`, desktop/mobile media rules | Current host-only buttons are generated only for non-host targets. Multiple delegated handlers and mobile clones exist; see risks. |
| Topic | `room.html`, `room.js::renderTopic()` and edit helpers | `.topic-row`, `.topic-content`, `.topic-heading`, `.topic-text`, `.topic-actions` | Preserve `#topicRow`, `#topicDisplay`, `#topicTicketLink` and dynamically created edit/save/cancel/clear IDs. |
| Results | `room.html`, `room.js::renderResultBar()` | `#resultRow`, `.result-row`, `.consensus-row`, `.average-label` | `#resultAnnounce` is the persistent live region. Hidden state reserves space through visibility. |
| Voting deck | `room.js::renderCards()` | `#cardGrid`, `.card-grid`, card state selectors | Card values, sizing, wrapping, selection, disabled behavior and heat colors are frozen. |
| Host round action | `room.html`, `room.js` | `.vote-actions`, `#revealButton`, `#resetButton` and mobile sticky rules | Buttons remain host-only. At narrow widths they are fixed above the footer with matching container clearance. |
| Guide | `fragments/kbase.html` | `.room-manual*` | Native `details` behavior, content and closed initial state are frozen. |
| Leave / close | `room.html`, `menu.html`, `room.js` | `.room-exit-row`, `.room-exit-action` | `#leaveRoomBtn` is available to every role. `#closeRoomBtn` is host-only; menu leave is shown to non-hosts. |
| Settings menu | `fragments/menu.html`, `menu.js`, `room.js::syncMenuFromState()` | `.menu-overlay`, `.menu-panel`, `.menu-*` | Menu lifecycle belongs to `menu.js`; room state only controls room-specific content and permissions. |

Most presentation work can remain in `styles.css`. RP-001 and RP-002 may make
small semantic markup adjustments in `room.html` while retaining all IDs. RP-003
and RP-004 necessarily touch participant DOM created by `renderParticipants()`;
those changes require focused behavior and permission tests.

## Current role and state behavior

- `body.is-host` mirrors current client host state. Reveal/reset, topic actions,
  room settings and participant actions are rendered or exposed from that state.
- Participant action buttons are generated only when the current user is host
  and the target participant is not host. The current host row therefore has no
  self-action trigger.
- Guests and spectators receive no participant action buttons from
  `renderParticipants()`.
- The WebSocket handler independently checks current host identity before
  `makeHost`, `kick`, target spectator/participation changes, topic mutations,
  sequence/settings changes and room closure.
- A participant is visually inactive when `disconnected` or `away`. A spectator
  is detected from either `spectator === true` or `participating === false`.
- Host changes arrive through room state and cause the participant list and
  menu state to render again. RP-004 must verify that no open action menu can
  retain stale privileges across that rerender.

## Existing focused test coverage

The closest reusable specifications are:

- metadata/header/responsive: `header-shell.spec.ts`,
  `interface-presentation.spec.ts`, `control-geometry.spec.ts`;
- participant list/status/count: `participants-list.spec.ts`,
  `participant-heading.spec.ts`, `presence-lifecycle.spec.ts`,
  `prod-host-spectator-icon.spec.ts`;
- host permissions/actions: `host-and-close.spec.ts`, `kick-flow.spec.ts`,
  `participation-spectator.spec.ts`, `host-label.spec.ts`;
- vote geometry and state: `participant-chip-centering.spec.ts`,
  `result-card-alignment.spec.ts`, `cards-reveal.spec.ts`, `reset-flow.spec.ts`,
  `vote-change.spec.ts`;
- topic behavior and permissions: `topic-panel.spec.ts`, `topic-flow.spec.ts`,
  `topic-visibility-toggle.spec.ts`;
- guide and exit: `room-manual.spec.ts`, `room-exit.spec.ts`;
- keyboard/menu/accessibility: `accessibility.spec.ts`,
  `menu-hierarchy.spec.ts`, `settings-container.spec.ts`.

Each later ticket should select only the relevant subset and add precise
geometry or permission assertions for the changed surface.

## Risks and constraints found by the audit

1. Participant actions currently have more than one delegated/capture handler in
   `room.js`, including historical fallback/hotfix paths. Mobile action controls
   are cloned into `.row-actions` during render and again synchronized after
   viewport changes. RP-004 must first choose one existing canonical command path
   and prove single dispatch; presentation work must not layer a new handler on
   top of all existing paths.
2. The stylesheet contains several accumulated desktop centering blocks for
   results, cards and participant chips. Final cascade order currently supplies
   the working geometry. Tickets must change the narrowest final owner and must
   not broadly consolidate these rules while changing appearance.
3. Several desktop rules target `.row-left`, but the current participant renderer
   appends icon and name directly to `.participant-row`; these selectors are not
   safe evidence of live structure.
4. `.vote-chip` enters using `transform: translateY(...)`; its stable horizontal
   center uses the separate `translate` property. Combining these transforms can
   reintroduce the previously fixed chip drift.
5. The approved target order is topic before participants whenever the topic is
   enabled and visible. When the topic is disabled, no empty placeholder is
   reserved there. RP-002 may perform the smallest safe DOM adjustment required
   for that order while preserving all topic IDs, handlers, permissions and
   visibility behavior.
6. The mockup shows controls in illustrative guest/mobile states that are not
   permitted by the role matrix. They must never be used as implementation
   evidence.
7. The fixed footer and mobile fixed host action already rely on coordinated
   bottom clearance. RP-005/RP-006 must measure the final voting row, guide and
   leave action rather than changing global footer spacing speculatively.

## RP-000 verification

This ticket changed documentation only. No application code, generated markup,
styles, JavaScript, backend behavior or tests changed. No test suite was run;
the audit used source inspection and the existing focused test inventory, as
required for the read-only baseline ticket.

## RP-001 result

Room metadata remains a semantic `dl` and retains the functional IDs
`#youName`, `#roomCodeVal` and `#copyRoomLink`. Two `.main-info-group` wrappers
provide the compact visual grouping: they share a quiet token-based surface,
use the existing localized labels in small uppercase presentation and protect
long visible values with ellipsis while leaving their complete DOM text
available to assistive technology. The groups remain side by side from 375px
upward and stack at 320px so the existing 40px mobile copy target cannot collide
with a long room code.

The shared `--ui-meta-label-size`, `--ui-meta-label-weight`,
`--ui-meta-label-line-height` and `--ui-meta-label-spacing` tokens now keep room
metadata, topic and participant labels typographically aligned.

The focused Chromium checks cover 320, 375, 768, 769 and 1280px, long names and
room codes, Dark, Light and System Light, overflow, label hierarchy and the copy
target. Existing mobile-content and participant identity checks also pass. The
TypeScript build check and Maven package (`-DskipTests`) pass. Full Maven,
Playwright, cross-browser and screenshot suites were intentionally not run.

## RP-002 result

The existing `#topicRow` is now located between `.main-info` and the participant
heading. Its established `hidden`, `.is-hidden`, `data-visible` and inline
`display` synchronization remains unchanged, so a disabled topic reserves no
space. Every existing topic ID and the delegated edit/save/cancel/clear handlers
remain intact.

The panel now uses `--ui-surface-raised`, `--ui-surface-border`, the RP-001
`--ui-meta-label-*` tokens and existing radius/shadow tokens. The icon is quiet
and neutral, the title remains below hero size, and existing host controls stay
right aligned. Long content wraps without horizontal overflow.

Focused Chromium validation passed at 375 and 1280px in Light, Dark and System,
including long content, external ticket URLs, order geometry, complete hidden
collapse, host editing and propagation to guest and spectator clients. A real
Guest-to-Spectator transition confirmed that neither role receives topic action
controls. The TypeScript build check and Maven package (`-DskipTests`) pass.
Full Maven, Playwright, cross-browser and screenshot suites were intentionally
not run.

