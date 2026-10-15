# Planning Poker — Post-Redesign Change Requests

Status: **CR-001 through CR-004 complete and deployed in `e84cecd`**
Scope: Follow-up UX improvements after the Major Redesign release.  
Execution rule: **One CR at a time; mandatory start gate; approval; implementation through DONE; separate commit; STOP.**

## Mandatory CR Start Gate (applies to CR-001 through CR-004)

**Do not begin implementation merely because a ticket is mentioned or requested to start.** First execute this gate and wait for approval.

1. Re-read the project's current `README.md`, `docs/BRIEFING.md`, active architecture documentation, this CR backlog, and the current status/handoff document. If filenames or locations have changed, identify the canonical replacements instead of assuming outdated paths.
2. Check Git branch, working-tree state, latest completed change, deployment baseline and relevant frozen functional contracts. Check whether there are any unfinished changes or other active tickets.
3. Read **only the target CR** in detail and inspect the relevant files/contracts before recommending an approach. Identify risks, dependencies and any uncertain existing behavior.
4. Report **before any source-code change**: target CR, current branch/status, short implementation plan, current model if reliably observable, recommended **exact** model, whether a model switch is advisable, and the narrowly scoped validation plan. If the current model cannot be reliably determined, say so; do not guess or imply the agent can switch models itself.
5. **WAIT for explicit user approval** of the CR start and model choice. No implementation commands or source changes before approval. Read-only inspection for the gate is allowed.
6. After approval, implement **only that CR**, preserving all frozen game contracts. Follow existing project patterns; no unrelated refactors or design drift. If scope must expand or existing behavior contradicts the ticket, STOP and request permission.
7. Run focused relevant tests first, without skips, retries or weakened assertions. Escalate to wider tests **only** when the change/risk warrants it or the user authorizes it. Report tests actually run and those intentionally deferred. Do not claim a full regression if not performed.
8. Update this CR's `Result` and the project's canonical status/handoff document with changed files, decisions, verification, risks and handoff. Mark DONE only when acceptance criteria pass. Create a separate descriptive commit, ensure a clean working tree, then **STOP**. Do not automatically start the next CR or deploy to production unless separately approved.
9. If available agent quota is low (approximately <20%), do not begin a new CR; record a handoff and stop. Optimize token use through targeted file inspection and tests, **not** by compromising required behavior or evidence.

## Frozen functional boundary

Room creation/join/invite, identity/CID, participant lifecycle, host/host-transfer, voting/reveal/reset, sequences and special cards, spectators, topic visibility/editing/persistence, menu permissions, WebSocket events/payloads, persistence and backend behavior must remain unchanged **unless a ticket explicitly permits an already-existing behavior to be exposed through another UI entry point**. CR-003 may reuse existing leave/close actions, but must not silently change their semantics.

---

### CR-001 — Improve estimation topic visibility

- **ID:** CR-001
- **Title:** Improve estimation topic visibility
- **Goal:** Make the currently estimated topic immediately recognizable as a distinct functional element.
- **Status:** DONE
- **Recommended Model:** **GPT-5.6 Sol** — bounded UI/presentation change; propose a stronger model only if the audit uncovers unexpected lifecycle or permission coupling.

**Scope**
- Replace the current visually inconspicuous topic row with a dedicated, compact topic panel.
- **Approved visual design:**
  - subtle panel background and optionally a restrained left accent border
  - blue clipboard/list icon
  - compact uppercase heading: DE `AKTUELLES SCHÄTZTHEMA`; EN `CURRENT ESTIMATION TOPIC`
  - topic title prominently displayed below the heading
  - existing edit action at the upper right, with pencil icon
  - existing delete action retained in an appropriate place
  - optional ticket URL as a discreet clickable link
- Long titles wrap across multiple readable lines instead of being cut off.
- Preserve responsive behavior and Light/Dark/System + Dev/Clean styling.

**Out of Scope**
- No changes to topic data, visibility logic, permissions, editing, WebSocket events or persistence.
- No changes to participant rows, voting or other room functions.

**Acceptance Criteria**
- Topic clearly reads as the active estimation subject, not an additional participant row.
- Approved visual hierarchy is faithfully implemented, including icon, label, title and actions.
- Current edit/delete permissions and behavior remain intact.
- Hidden, empty and populated topic states work correctly; no forced visibility.
- Long titles and links do not overflow horizontally; DE/EN, keyboard and mobile work.

**Validation:** Focused topic visibility/editing/permissions tests and responsive checks. No full regression by default.

**Result**
- Changed files: `room.html`, `styles.css`, `room.js`, both message bundles,
  focused topic tests, cache-busting template references and status documents.
- Decisions: Used one semantic topic panel with a blue inline SVG icon, a
  separate optional ticket link and the existing host-only actions. Long titles
  wrap in place. Topic Save/Cancel now has one delegated click lifecycle instead
  of overlapping pointer and click handlers.
- Tests: `npm run ci:verify`; focused Playwright topic flow, visibility and panel
  tests (7 passed), plus a final host/guest and empty-editor rerun (3 passed).
  Responsive geometry covered 375 px and 1280 px in Light/Dark and Dev/Clean.
- Findings / downstream effects: The empty-topic editor defect was caused by
  duplicate Save/Cancel bindings and is fixed within this CR. Topic data,
  permissions, WebSocket messages and persistence contracts remain unchanged.
- Completion: Acceptance criteria passed; no full regression was required for
  this bounded UI change.

---

### CR-002 — Replace room information panels with collapsible manual

- **ID:** CR-002
- **Title:** Replace room information panels with collapsible manual
- **Goal:** Remove redundant informational content from the room view and provide contextual instructions on using the application.
- **Status:** DONE
- **Recommended Model:** **GPT-5.6 Sol** — constrained UI/content task; escalate only if integration reveals unexpected dependencies.

**Scope**
- Remove existing informational/FAQ cards beneath the voting area **from the room view**.
- Replace with a single collapsible manual, **collapsed by default**:
  - DE `Anleitung & Funktionen`
  - EN `Guide & Features`
  - book-open icon left; chevron indicator right
  - restrained surface/border aligned to current UI
- Prefer native `<details>`/`<summary>` if compatible with existing styling and accessibility needs.
- Manual must explain real functionality rather than repeat About-page marketing: joining/inviting, selecting cards, reveal/new round, roles, card sequences/special cards, spectator mode, topics, auto-reveal/settings, and **individual leaving vs closing for everyone**.
- Provide consistent German and English texts, matching actual current behavior.
- About page remains unchanged and serves the conceptual explanation.

**Out of Scope**
- No gameplay changes, new settings, permissions, UI library or duplicate About marketing copy.

**Acceptance Criteria**
- Old room information panels are gone; a single manual is present and initially closed.
- Expand/collapse works with pointer, keyboard and screen readers; state is not opened unexpectedly.
- Content accurately describes currently implemented features; translation parity is maintained.
- Light/Dark/System, Dev/Clean and responsive layouts do not overflow.

**Validation:** Focused manual/accordion, keyboard and responsive checks; no full regression by default.

**Result**
- Changed files: the existing `kbase.html` room fragment, `room.html`, shared
  styles and message bundles, focused responsive tests, and status documents.
- Decisions: Reused the existing room-only fragment for one native `<details>`
  guide. It is closed by default, needs no JavaScript, and uses the shared
  surface, focus and responsive tokens. Six concise sections describe existing
  room behavior without repeating About-page marketing copy.
- Tests: `npm run ci:verify`; focused Playwright guide and mobile-content tests
  (9 passed), followed by the final guide/accessibility rerun (6 passed).
  Coverage includes keyboard operation, DE/EN, 320/375/768/1280 px,
  Light/Dark/System and Dev/Clean.
- Findings / downstream effects: The former four-card accordion and its
  one-open-panel script were removed. No game, menu, state, event or WebSocket
  contract changed.
- Completion: Acceptance criteria passed; no full regression was required for
  this bounded content and presentation change.

---

### CR-003 — Improve room exit discoverability

- **ID:** CR-003
- **Title:** Improve room exit discoverability
- **Goal:** Make leaving a room obvious without confusing individual departure with host-only closing for everyone.
- **Status:** DONE
- **Recommended Model:** **GPT-5.6 Sol** for a clearly existing and well-characterized leave/close contract; **propose GPT-6 Sol/Astra only if inspection reveals uncertain host-transfer, identity or WebSocket lifecycle coupling**, and wait for approval.

**Mandatory pre-implementation audit**
- Locate and characterize the **existing** individual `Leave Room` action, host `Close room for everyone` action, permissions, redirects, confirmation behavior, WebSocket/participant effects, and their UI bindings.
- **Verify what happens when a host leaves individually:** Does existing behavior transfer host status automatically, end the room, or do something else? Inspect code and relevant tests; do **not** assume host handover exists or works.
- State findings in the start-gate report. If host departure or transfer behavior deviates from the intended individual-leave semantics, **STOP and request a separate functional decision before changing any lifecycle code**. Do not silently implement host transfer or change close-room semantics.

**Scope**
- Reuse existing **individual Leave Room** action and its lifecycle handling. Do not implement a second leave path.
- Add a clearly visible **Leave Room** control **below the voting area and the collapsed manual, before the footer**, for hosts and regular participants alike.
- **Approved button design:**
  - `log-out` icon on left
  - DE `Raum verlassen`; EN `Leave room`
  - restrained dark red/rose secondary styling, subtle border, existing rounded shape language
  - clear hover/focus/active states in Light/Dark/System and Dev/Clean
- **Menu behavior by role:**
  - **Host:** show `Raum für alle schließen` / `Close room for everyone`, **not** the redundant individual leave entry in the menu.
  - **Participant:** show `Raum verlassen` / `Leave room` as the equivalent of the bottom button.
- The host's bottom **Leave Room** control is **individual departure only**, never `Close room for everyone`.
- Keep existing host-only close confirmation and all close-for-everyone semantics intact.

**Out of Scope**
- No new room-exit protocol, no changes to room/CID/persistence/WebSocket/host-transfer rules or permissions.
- No implicit equivalence between leaving and closing a room.
- No unrelated menu refactor.

**Acceptance Criteria**
- Both host and participant can find the bottom Leave Room control.
- Bottom control calls exactly the existing individual leave behavior; leaving does not close the room for everyone.
- Host menu offers **only** host-specific close-for-everyone action; participant menu offers individual Leave Room.
- Existing confirmation and permissions for close-for-everyone remain unchanged.
- Individual host departure is tested against the **existing** host-transfer behavior; any defect or requirement mismatch is reported before scope expansion.
- No double dispatch/duplicate participant removal caused by the two entry points.
- DE/EN, mobile, accessibility and all themes/styles work.

**Validation:** Targeted host/guest leave-vs-close tests, existing host-transfer tests or characterization checks, permissions, relevant menu behavior and responsive checks. No full regression by default; do not mask functional failures as cosmetic.

**Result**
- Changed files: room and menu templates, `room.js`, shared CSS, English/German
  messages, the room guide, focused room-exit and mobile tests, and status files.
- Existing leave/host-transfer behavior: Navigating away closes the room socket;
  the server marks that participant inactive after about two seconds and
  transfers an inactive host to another participant after about five seconds.
  The room remains open. Browser tests verified this path and one
  `participantLeft` event for the departing host.
- Decision: Both Leave room buttons use one client handler that clears the
  per-tab return link and navigates home. The user explicitly approved this
  existing navigation/disconnect path after the start-gate audit. The unused
  `intentionalLeave` protocol was left untouched because combining it with
  normal socket closure could duplicate leave notifications.
- Tests: Spring Boot package build, `npm run ci:verify`, an initial 18-test
  Playwright run including room-return, followed by a final 26-test run for
  room exit, mobile layout, guide, menu and host-close behavior. Verified
  host/guest permissions, existing close confirmation, keyboard use,
  DE/EN labels, 375/1280 px, Light/Dark/System and Dev/Clean.
- Findings / downstream effects: The host menu keeps Close room for everyone;
  guests see Leave room there. The bottom Leave room action is available to
  both roles. No backend lifecycle, WebSocket protocol or game logic changed.
- Completion: Acceptance criteria passed; separate commit, then STOP.

---

### CR-004 — Improve participant section heading

- **ID:** CR-004
- **Title:** Improve participant section heading
- **Goal:** Improve the informational value and visual hierarchy of the participant section heading.
- **Status:** DONE
- **Recommended Model:** **GPT-5.6 Sol**

**Scope**
- Retain the semantic participant `h2` and add a discreet count of the rows currently displayed.
- Keep the heading compact on desktop and mobile and use existing typography and color tokens.
- Preserve participant state, lifecycle and WebSocket contracts.

**Result**
- The room heading now renders `Participants · n` / `Teilnehmende · n`, with the number in a subtle neutral badge.
- `renderParticipants()` updates the count after replacing the displayed roster, so host, spectator and disconnected rows remain counted while removed rows do not.
- The count and separator are hidden from assistive technologies because the participant list is already the live region. The semantic heading therefore retains a stable accessible name without duplicate announcements.
- Focused Chromium coverage verifies join, spectator, disconnected and removed states plus English/German layout at 375 and 1280 px.
- Production validation covered the same participant states plus two-user vote,
  reveal and reset flows in Dev and Clean styles.
- No room state, participant management, gameplay, backend or WebSocket behavior changed.

---

## Proposed execution order and handoff

**CR-001 → CR-002 → CR-003 → CR-004**. All four requests are complete. The approved visual references are the topic panel, rose-toned logout button and compact participant heading discussed in the project conversation; do not reinterpret them into unrelated design variants.

**Start prompt for each ticket:**

> Bitte führe ausschließlich das Mandatory CR Start Gate für CR-00X aus. Noch keine Implementierung. Berichte Status, mögliche Risiken, genaues empfohlenes Modell und schlanken Testplan. Warte dann auf meine Freigabe.

**Approval prompt after gate:**

> Modellwahl bestätigt, CR-00X freigegeben. Bitte nur dieses Ticket gemäß Backlog bis DONE umsetzen, fokussiert testen, Status/Backlog aktualisieren, separat committen und STOP.
