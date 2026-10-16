# Planning Poker — Documentation & In-App Guide Refresh

**Status:** COMPLETE — DOC-001, DOC-002 AND DOC-003 COMPLETE
**Scope:** In-room manual, About, German and English user guides, documentation consistency  
**Recommended model:** GPT-5.6 Sol (review complexity before each story)  
**Target:** `docs/` (this file); implementation only after explicit per-story approval

## 1. Purpose and source of truth

Make the documentation useful for a broad audience without changing the established concise, friendly, factual tone. Clearly separate:

| Surface | Question it answers | Editorial scope |
|---|---|---|
| In-room **Anleitung & Funktionen / Guide & Features** | How do I use the app? What does the UI mean? | Short, practical, in context |
| **About** page | What is Planning Poker, why use it, and what does the tool offer? | Conceptual, inviting, SEO-friendly |
| `docs/USER-GUIDE.md` and `docs/USER-GUIDE-EN.md` | What exactly happens, including edge cases and troubleshooting? | Authoritative, detailed end-user reference |
| `docs/STYLE.md` | What visual/editorial consistency rules apply? | Brief design and writing conventions |
| `docs/INDEX.md` | Where is information documented? | Navigation and accurate state |

**Authoritative behavior = actual code on the current deployed `main`**. Existing documentation may be out of date. Do not propagate contradictions from the old guides. Use the current source and tests to settle factual details; stop and ask when behavior remains ambiguous. Do not create yet another parallel `MANUAL.md` or `HELP.md`.

Current entry points observed in repository:
- `src/main/resources/templates/fragments/kbase.html`: in-room `<details>` manual, closed by default
- `src/main/resources/messages_de.properties` and `messages.properties`: `manual.*`, `about.*` translations
- `src/main/resources/templates/about.html`: About markup
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE-EN.md`, `docs/STYLE.md`, `docs/INDEX.md`
- `GameService.java`: server-side vote, consensus, outlier rules

## 2. Binding editorial rules (DE / EN)

- Preserve the existing clear, straightforward, concise text style; no marketing exaggeration, no additional decorative emoji parade.
- **All German-language human role nouns must be inclusive**, preferably by natural gender-neutral wording rather than special characters: `Teilnehmende`, `Zuschauende`, `Nutzende`, `Teammitglieder`, `Teamleitung` etc. Prefer direct address (`du` / `ihr`) when natural.
- **English loanwords and role titles in German remain unchanged**, e.g. `Host`, `Scrum Master`, `Product Owner`, `Developer`, `Stakeholder`, `Planning Poker`, `Story Points`, `User Story`. Do not invent forms such as `Host:innen`.
- Avoid mechanical word substitution where the whole sentence can read more naturally.
- In English use natural phrasing, not literal German calques. DE/EN must convey equivalent behavior, scope and permissions.
- Maintain stable i18n keys and actual product labels unless there is a carefully approved reason to add keys. Keep source-file encoding/escaping convention compatible with existing `.properties` handling.
- Do not assert unverified features, fixed timing thresholds, lifetime guarantees, card values or shortcuts.
- Distinguish **system states**, **user-chosen estimates/special cards**, and **result interpretation**. System information should be neutral; consciously chosen special cards may have personality; celebration emoji 🎉 for consensus remains intentional.
- No gameplay, server state, WebSocket, permissions, role lifecycle, persistence behavior, appearance/CSS or menu functionality changes in this documentation epic.

## 3. Proposed in-room manual (German copy)

The following text is proposed **copy**, not a claim that every edge-case is already verified. Confirm the notes in §3.2 against current code before committing. Keep the accordion **collapsed by default**, its summary, keyboard behavior, section layout and positioning unchanged.

### Beitreten und einladen
Über den Link-Button neben dem Raumcode kopierst du eine Einladung. Alle treten mit ihrem eigenen Anzeigenamen bei. Stimmen und Änderungen werden automatisch mit den anderen Teilnehmenden synchronisiert.

### Schätzen und aufdecken
Wähle eine Karte für deine Schätzung. Du kannst deine Auswahl ändern, solange die Stimmen noch nicht aufgedeckt wurden.

Die anderen sehen zunächst nur, ob du bereits abgestimmt hast – nicht, welche Karte du gewählt hast.

Der Host deckt die Stimmen auf. Nach der Diskussion startet ihr bei Bedarf eine neue Runde.

### Abstimmungsstatus und Ergebnisse
Die Symbole in der Teilnehmerliste zeigen, ob jemand bereits abgestimmt hat, noch keine Karte gewählt hat oder gerade nicht aktiv teilnimmt.

Nach dem Aufdecken werden die gewählten Karten sichtbar. Bei unterschiedlichen numerischen Schätzungen zeigt Planning Poker:

- **Durchschnitt:** den Mittelwert der Schätzungen.
- **Median:** den mittleren Wert der sortierten Schätzungen.
- **Spanne:** die niedrigste und höchste Schätzung.

Stimmen, die am stärksten vom Durchschnitt abweichen, können einen zusätzlichen Rahmen erhalten. Die Markierung hilft, unterschiedliche Einschätzungen zu erkennen. Sie bedeutet nicht, dass eine Schätzung falsch ist.

Liegen alle berücksichtigten Schätzungen gleich, zeigt Planning Poker einen Konsens an.

### Kartensätze und Spezialkarten
Der Host wählt die Kartensequenz und kann zusätzliche Spezialkarten aktivieren.

Neben Zahlen oder Größen stehen je nach Einstellung Karten für offene Fragen, Pausen, Abhängigkeiten, Risiken oder weiteren Diskussionsbedarf zur Verfügung.

Spezialkarten sind keine numerischen Schätzungen und werden nicht in den Durchschnitt eingerechnet.

### Rollen und Teilnahme
Der Host steuert das Aufdecken, neue Runden und die Raumeinstellungen. Über die Teilnehmeraktionen kann er die Host-Rolle übertragen, jemanden zum Zuschauer machen oder aus dem Raum entfernen.

Zuschauende können die Schätzung verfolgen, ohne selbst abzustimmen. Im eigenen Menü kann die Teilnahme wieder aktiviert werden; auch der Host kann den Zuschauerstatus ändern.

### Schätzthema und automatisches Aufdecken
Der Host kann ein aktuelles Schätzthema mit Titel und optionalem Ticket-Link anzeigen. So ist für alle erkennbar, welche Aufgabe gerade geschätzt wird.

Ist das automatische Aufdecken aktiviert, werden die Karten aufgedeckt, sobald alle aktuell aktiv Mitschätzenden abgestimmt haben. Zuschauende werden dabei nicht berücksichtigt.

### Sprache und Darstellung
Sprache und Darstellung kannst du jederzeit ändern. Auf größeren Bildschirmen findest du die Schalter im Header, auf Smartphones im Menü.

Zur Auswahl stehen Deutsch und Englisch sowie Hell, Dunkel und System.

### Raum verlassen oder schließen
Mit „Raum verlassen“ scheidest nur du aus der Sitzung aus. Die anderen können weitermachen.

Der Host kann den Raum über die separate Funktion „Raum für alle schließen“ für sämtliche Teilnehmenden beenden.

### 3.1 English counterpart — proposed copy

#### Join and invite
Use the link button beside the room code to copy an invitation. Everyone joins under their own display name. Votes and changes are synchronized automatically for everyone in the room.

#### Estimate and reveal
Select a card for your estimate. You can change your selection until the votes are revealed.

Others can initially see only whether you have voted, not which card you chose.

The host reveals the votes. After discussing the results, you can start another round if needed.

#### Voting status and results
Symbols in the participant list show whether someone has voted, has not selected a card, or is not currently taking part in voting.

After the reveal, the selected cards become visible. When numeric estimates differ, Planning Poker shows:

- **Average:** the arithmetic mean of the estimates.
- **Median:** the middle value of the sorted estimates.
- **Range:** the lowest and highest estimates.

Estimates furthest from the average may receive an additional outline. This helps the team spot different perspectives; it does not mean an estimate is wrong.

When all eligible estimates agree, Planning Poker displays consensus.

#### Decks and special cards
The host selects the card sequence and can enable optional special cards.

Depending on the settings, cards can signal open questions, breaks, dependencies, risks or other topics to discuss.

Special cards are not numeric estimates and are not included in the average.

#### Roles and participation
The host manages revealing cards, starting new rounds and room settings. Participant actions allow the host to transfer the host role, switch someone to spectator mode or remove them from the room.

Spectators can follow the session without voting. They can enable participation from their own menu; the host can also change their spectator status.

#### Topic and automatic reveal
The host can display an estimation topic with a title and optional ticket link so everyone knows what is being estimated.

When automatic reveal is enabled, cards are revealed once everyone currently eligible to vote has voted. Spectators are not included.

#### Language and appearance
You can change the language and appearance at any time. On larger screens, the controls are in the header; on phones, they are in the menu.

Choose English or German, and Light, Dark or System appearance.

#### Leave or close the room
“Leave room” exits only your session. The others can continue.

The host can use the separate “Close room for everyone” action to end the room for all participants.

### 3.2 Checks before publishing manual

- Confirm precise UI meanings of pending vote, hidden vote, disconnected/inactive, spectator and `–`/hourglass states.
- Verify special-card participation in statistics and what happens in all-special/no-numeric-vote rounds.
- Verify precise consensus conditions (especially special cards, inactive voters and nonparticipating users).
- Verify automatic-reveal eligibility for disconnected participants and all voting edge cases.
- Confirm terminology of host operations and exactly who can use them; never infer from the illustrative mockups.
- Keep topic editing/deleting and room-closing permissions as they are.
- Avoid overstating outlier detection. Current `GameService.farthestFromAverageNames`: marks a **single furthest-from-mean numeric vote** when there are at least 3 numeric votes and unequal values; ties are marked only with at least 5 numeric voters; otherwise no outliers. No universal statistical significance threshold or “wrong vote” interpretation. Include exact algorithm in user guides (not in-room copy).
- Validate text length and wrapping on 320/375/393 px and both themes, without changing visual design.

## 4. About page — focused edit, not second manual

**Keep:** existing page structure, intro, benefits, quick-start, technology section, CTA, SEO terms (`Planning Poker`, `Scrum Poker`, `Estimation Poker`, `agile Teams`, `Aufwandsschätzung`), and i18n infrastructure. Do not turn About into instructions for individual controls. Leave the existing design and headers in place.

### 4.1 Proposed revised German “Was ist Planning Poker?” copy

Planning Poker (auch bekannt als Scrum Poker oder Estimation Poker) ist eine Methode, mit der Teams den Aufwand oder die relative Größe von Aufgaben gemeinsam einschätzen.

Alle Beteiligten wählen ihre Schätzung zunächst verdeckt. Erst anschließend werden die Karten gleichzeitig aufgedeckt.

So wird vermieden, dass die zuerst genannte Zahl unmittelbar die Einschätzungen der anderen beeinflusst.

Unterschiedliche Schätzungen sind dabei ausdrücklich erwünscht: Sie machen verschiedene Sichtweisen sichtbar und liefern wertvolle Anlässe für eine gemeinsame Diskussion.

Ziel ist nicht, möglichst schnell eine Zahl zu finden, sondern ein gemeinsames Verständnis der Aufgabe zu entwickeln.

**Implementation note:** Current About markup has `about.what.p1` and `.p2`. Prefer editing these two keys with appropriately grouped paragraphs. Do not add new paragraphs or keys unless the existing markup cannot preserve readability and approval is granted.

### 4.2 English meaning-equivalent proposal

Planning Poker (also called Scrum Poker or Estimation Poker) helps teams estimate the effort or relative size of tasks together.

Everyone chooses an estimate privately. The cards are then revealed at the same time, reducing the influence of the first number spoken on other estimates.

Different estimates are welcome: they make different perspectives visible and give the team useful reasons to discuss the work. The goal is not simply to reach a number quickly, but to build a shared understanding of the task.

### 4.3 Proposed “Hauptfunktionen” content (DE)

- Gemeinsames Schätzen in Echtzeit, ohne Registrierung
- Verschiedene Kartensätze und optionale Spezialkarten
- Manuelles oder automatisches Aufdecken
- Übersichtliche Ergebnisse mit Durchschnitt, Median, Spanne und Konsens
- Hervorhebung besonders abweichender Schätzungen als Diskussionshilfe
- Host-Funktionen und Zuschauermodus
- Schätzthemen mit optionalem Ticket-Link
- Deutsch und Englisch, helles und dunkles Design
- Bedienung am Desktop, Tablet und Smartphone

**Implementation note:** This is editorial target copy. The current About template lists benefits and features with individual i18n keys. Prefer adapting existing entries in place; only add/remove list items with minimum necessary markup and matching translation updates. Supply natural equivalent English copy; preserve SEO and structure. Do not promise persistence or room lifetime beyond what current production behavior supports.

### 4.4 Further About cleanups

- Soften the current categorical “prevents cognitive bias” claim to **reduces anchoring / limits direct influence**.
- Prefer user-facing benefits to mentioning WebSocket as a headline capability; technology remains in Technology section.
- Keep calls to action and quick-start largely unchanged, correct only verified inaccuracies.
- Preserve the existing product name and established page meta/canonical/structured data.
- Check duplicate `about.*` entries currently visible in `messages.properties`; remove true duplicates only after verifying which definition is effective and whether there is any meaningful mismatch. Preserve effective values.

## 5. User guides — required audit and recommended changes

Update **both** `docs/USER-GUIDE.md` and `docs/USER-GUIDE-EN.md`. Avoid just adding the new outlier paragraph to an already stale guide.

| Section | Observed issue / action |
|---|---|
| Card decks | Old Fibonacci examples include `21` in places; enumerate actual decks from `CardSequences.java`, including all optional special cards currently supported. |
| Numeric card meaning | Replace universal hour/day translations (`1 = 1–2 hours`, `5 = 1–2 days`, etc.) with **team-defined relative size/complexity**. Do not imply Story Points are a standard time conversion. |
| Status icons | Old `✓` explanations do not match present UI. Explain pending / voted-hidden / revealed / spectator / inactive markers according to actual UI. |
| Results | Explain average, median, range, consensus and exclusions for non-numeric special cards accurately. Include outlier explanation below. |
| Host actions | Update for current three-dot menu, role transfer, spectator toggle, removal, restrictions and host handoff behavior; verify edge cases. |
| Room menu | Desktop preference controls live in header, mobile in menu; menus expose only appropriate actions for host versus guest. |
| Persistence/connection | Audit old claims: “memory-only rooms by default”, room cleanup times, reconnection thresholds, role reclaim, etc. Check current FTPS implementation and actual config; avoid unverified availability promises. |
| Navigation | Explain leaving individually versus closing for everyone; optional return-to-room behavior only as implemented. |
| Keyboard shortcuts | Validate each listed key (`1-9`, `?`, `Space`, `R`, `V`, `Esc`) in code and tests; remove anything not confirmed. |
| UI diagrams | Update or remove old ASCII diagrams and misleading screenshots, using current desktop/mobile structure and current labels. |
| Responsive | Do not recommend landscape as mandatory or default if portrait works. |
| Examples | Update roles, special-card availability and button names. Do not hard-code outdated time/date assumptions. |
| Gender-inclusive German | Apply §2 consistently to prose, tables, headings and examples. |

### 5.1 Precise outlier explanation for detailed guides

**DE proposed copy:**

> Nach dem Aufdecken kann ein zusätzlicher dezenter Rahmen eine Schätzung kennzeichnen, die am weitesten vom arithmetischen Durchschnitt entfernt liegt. Dabei berücksichtigt das System nur numerische Stimmen. Die Markierung wird ab mindestens drei numerischen Stimmen geprüft. Gibt es genau eine Schätzung mit dem größten Abstand, wird diese markiert. Gibt es mehrere gleich weit entfernte Schätzungen, werden sie nur bei mindestens fünf numerischen Stimmen markiert. Bei ausschließlich gleichen numerischen Stimmen gibt es keine Ausreißer-Markierung. Sie ist eine Gesprächshilfe, kein Qualitätsurteil: Eine abweichende Schätzung ist nicht automatisch falsch.

**EN proposed copy:**

> After reveal, a subtle extra outline may highlight an estimate furthest from the arithmetic mean. Only numeric votes are considered. Outliers are evaluated when at least three numeric votes exist. A uniquely furthest estimate is highlighted. If several estimates are equally farthest, they are highlighted only when at least five numeric votes exist. Identical numeric estimates have no outlier marker. The marker is a discussion aid, not a judgment that an estimate is wrong.

**Verification:** Treat algorithm above as based on the inspected current `GameService.java` implementation; reconfirm against the integration branch before editing.

### 5.2 Example of better estimation-language guidance

Replace absolute time mappings with a brief explanation such as:

> **Story Points** sind eine relative Schätzgröße. Ob eine `5` mehr Aufwand als eine `3` bedeutet, ist im Kartensatz klar; wie viel Zeit das bedeutet, legt die Zahl dagegen nicht allgemein fest. Einigt euch als Team auf gemeinsame Vergleichsbeispiele.

EN: 

> **Story Points** express relative size, not a universal time conversion. A `5` represents more than a `3` in a numeric deck, but it does not correspond to a fixed number of hours or days. Agree on comparison examples within your team.

### 5.3 Proposed document-role policy

- The guides are the detailed end-user reference and should be internally consistent with the code.
- The room manual is a concise in-app subset, never a second contradictory specification.
- About explains the method and product, not detailed control semantics.
- `docs/INDEX.md` retains links to both guides and should reflect the actual review date/status; do not claim “no gaps” before the audit is finished.

## 6. `docs/STYLE.md` and `docs/INDEX.md`

### STYLE.md — concise editorial/design addition

> **Visual semantics:** System states inform quietly with neutral, monochrome UI symbols. Deliberate estimates and selected special cards may retain distinctive colors and personality. Results stay clear and factual; 🎉 for actual consensus is an intentional exception. Avoid purely decorative icons and do not repurpose voting semantics for system status.
>
> **Inclusive German:** Prefer natural gender-neutral people terms (`Teilnehmende`, `Zuschauende`, `Nutzende`) and direct address. Leave English professional/role words unchanged (`Host`, `Scrum Master`, `Product Owner`, `Developer`, `Stakeholder`). Keep DE/EN translations semantically equivalent.

Keep the existing single-interface style and Light/Dark/System policy (already documented); do not reintroduce Dev/Clean.

### INDEX.md

- Ensure the two User Guide links, scopes and descriptions are accurate.
- Correct stale “last reviewed”, “complete / no gaps” and arbitrary line-count statements where necessary.
- Do not reorganize the documentation hierarchy or add duplicate user-guide entry points.

## 7. Execution protocol — mandatory for EACH story

1. **Before work:** Read `README.md`, `docs/BRIEFING.md`, this file, and any story-relevant guide/template/resource. Check branch, clean tree, last completed story and current deployed baseline. Recommend the least costly suitable model. **Wait for explicit user approval** before implementing each story (and before changing models when appropriate).
2. **Scope:** Exactly ONE story at a time. Make no functional changes. If text review uncovers inconsistent code behavior or permissions, **STOP, report, request approval** rather than fixing behavior under a documentation ticket.
3. **Verification:** Only tests directly relevant to changed documentation (specific i18n/manual/About/links); do NOT run the full Maven/Playwright suite, production E2E or cross-browser matrix without a concrete reason and approval. Functional behavior must not be altered.
4. **Wrap-up:** Update this file's result/status for the completed story; briefly report edited files, resolved wording decisions, any unresolved caveats, exact tests and outcomes. Separate descriptive commit, clean tree; **STOP** before next story. Do not deploy without approval.
5. **Token economy:** Read only needed code paths per topic, batch searches, avoid repeated broad audits, and preserve a brief handoff if usage is low.

## 8. Work items

### DOC-001 — In-room manual DE/EN

**Status:** DONE
**Recommended model:** GPT-5.6 Sol  
**Depends on:** §3.2 behavior checks

**Goal:** Replace current six short topics with eight useful topics, using the §3 DE/EN copy (corrected for any findings). Keep existing `<details>` behavior, semantic HTML, responsive styling and default collapsed state.

**Files (expected):** `templates/fragments/kbase.html`, `messages_de.properties`, `messages.properties`, relevant focused manual/i18n tests.

**Acceptance:** Accurate DE/EN copy; all eight headings and their text appear under correct locale and language switching; no raw translation keys, missing content, duplicate IDs, permission leak or layout regression; accordion remains closed by default; no new behavior.

**Focused tests:** `tests/room-manual.spec.ts` and narrowly relevant i18n checks; targeted mobile rendering only if changed text causes wrapping.

**Result:** Replaced the six short guide topics with eight DE/EN sections while
preserving the existing collapsed `<details>` structure, keyboard behavior,
position and styling. Copy now distinguishes pending, hidden, spectator and
inactive states; numeric statistics from special cards; individual leave from
host-only room closure; and desktop/mobile preference locations. Code review
confirmed two necessary corrections to the proposal: auto-reveal requires a
numeric vote from every active participating person, and consensus requires at
least one numeric vote, equal numeric values and no infinity card; other special
cards are ignored by the current consensus comparison. A future product review
of consensus semantics around special cards and infinity remains intentionally
open; the present guide documents current behavior, under which a numeric vote
plus infinity is not consensus. `manual.*` key parity is 31/31. TypeScript
buildcheck passed; seven focused Chromium guide cases passed at
320/375/768/1280 px across Light/Dark/System plus keyboard, DE and language
switching, followed by the added 393 px responsive case. No functional, CSS,
permission, WebSocket or gameplay code changed.

### DOC-002 — About text precision DE/EN

**Status:** DONE
**Recommended model:** GPT-5.6 Sol  
**Depends on:** DOC-001 factual definitions

**Goal:** Preserve About layout and SEO, sharpen Planning Poker explanation and align feature list to current behavior using §4.

**Files (expected):** About `messages*.properties`, `templates/about.html` only if required for paragraph/list structure; focused SEO/i18n tests.

**Acceptance:** No absolute promise to eliminate cognitive bias; benefit and product overview clear; DE/EN consistent; no unnecessary detail duplication with room manual; heading/canonical/meta/schema intact; no feature claims unsupported by implementation.

**Focused tests:** About page render, DE/EN switching, page metadata/canonical; no full suite.

**Result:** Refined the existing two-paragraph DE/EN explanation without
changing the About structure: Planning Poker now describes private estimates,
simultaneous reveal, reduced anchoring influence, useful disagreement and shared
understanding without claiming to prevent cognitive bias. The existing benefit
list no longer promises persistent rooms and instead describes shareable invite
links. The feature list now covers nine verified user-facing capabilities,
including results, outlier discussion support, themes and responsive use; the
technology section remains separate. Three minimally required translation keys
and matching list items were added. Removed the second English `about.*` block:
all 29 duplicated definitions were byte-for-byte equivalent before editing.
Final DE/EN key parity is 35/35 with no English duplicates. TypeScript buildcheck
passed, as did three focused Chromium About content/language-switch tests and
the two existing DE/EN About metadata/canonical cases. Heading, CTA, metadata,
canonical URL, SEO terms and visual structure remain intact. No CSS, behavior,
permissions, state or gameplay code changed.

### DOC-003 — User Guides & doc style consistency

**Status:** DONE
**Recommended model:** GPT-5.6 Sol, upgrade only if the factual audit proves technically complex  
**Depends on:** DOC-001, DOC-002

**Goal:** Modernize both existing user guides; correct current functionality, deck values, statuses, result interpretation and examples per §5. Add §5.1 precise outlier rule. Update STYLE/INDEX briefly per §6. Apply inclusive language throughout all edited German documentation.

**Files (expected):** `docs/USER-GUIDE.md`, `docs/USER-GUIDE-EN.md`, `docs/STYLE.md`, `docs/INDEX.md`; no new parallel guides.

**Acceptance:** Guides reflect code rather than obsolete screenshots/text; technically correct outlier edge cases; cards and settings match active implementation; keyboard shortcuts tested/verified; DE/EN parity; valid navigation links; stale complete/current claims corrected; no gameplay changes.

**Focused tests:** Markdown/link/terminology checks and targeted code inspection for factual claims; no full test suite.

**Result:** Replaced both stale user guides with concise DE/EN references verified
against the current deck definitions, participant states, result calculations,
permissions, navigation and keyboard handlers. The guides now document exact
deck values and special cards, numeric-statistic exclusions, Infinity consensus
behavior and the precise outlier thresholds without fixed time, reconnect or
retention promises. Added matching visual/editorial conventions to `STYLE.md`
and refreshed `INDEX.md` while removing volatile line counts and unsupported
completeness claims. No application code or behavior changed.

## 9. Start prompt for Codex (copy/paste)

> Please read `README.md`, `docs/BRIEFING.md`, `docs/PLANNING-POKER-DOCS-REFRESH.md` and only the files relevant to **DOC-001**. Check current branch and the latest state. Apply the Mandatory Story Start Protocol in §7: first report scope, code-backed uncertainties, recommended model and focused test plan, then **WAIT for my approval**. After approval implement **DOC-001 only**, validate narrowly, document decisions, commit separately and STOP. Do not start DOC-002 or DOC-003 and do not deploy. No functional, design or CSS changes.

## 10. Final epic acceptance

- Room manual, About and both user guides tell the same accurate story at the right level of detail.
- All German people-role terms are inclusive; English terms in German remain unchanged.
- Results, outlier outlines, participation states and special-card semantics are documented without misleading claims.
- The existing friendly, concise writing style remains recognizable.
- No app behavior changes, no surprise visual redesign, no unnecessary broad regression suites.
- Three separate documented commits and clear approval/STOP gates.
