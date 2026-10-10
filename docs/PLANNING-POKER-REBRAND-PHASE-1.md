# Planning Poker rebranding: phase 1 implementation and validation checkpoint

Date: 2026-10-10. Branch: `rebrand/planning-poker`.
Checkpoint tag: `pre-planning-poker-rebrand`, unchanged at
`bd0afd381a03fa1528c401276a3ad0c53557de75`.

**Status: implementation committed; final build and browser validation pass.**
The user authorized the targeted transport correction after the original risk
checkpoint. All 29 Java tests and 98 browser tests pass. No push, merge or
deployment was performed; this report does not authorize a production release.

## Commits

| Commit | Message |
| --- | --- |
| e3ab00f | refactor: migrate Java package to planningpoker |
| c1ce7f6 | refactor: migrate frontend event namespace to pp |
| 191db62 | refactor: migrate browser storage with legacy fallback |
| 45b24cb | feat: rebrand product to Planning Poker |
| fb80ded | test: add PP environment names with EP compatibility |
| 71f29a6 | chore: align internal application naming |
| 4dbf1a8 | docs: update current branding to Planning Poker |
| 216d053 | fix: dispatch menu toggle events exactly once |
| c99a486 | test: align rebrand validation with current room UI |
| b63dca6 | docs: checkpoint rebrand validation and transport findings |
| f440c36 | fix: serialize WebSocket text writes per connection |
| 2ce4f18 | test: wait for confirmed room roles and voting readiness |

The final documentation commit records this report and the handoff state.
No commits were pushed; no merge, deployment or switch to main was performed.

## Implemented

- All 46 production and 9 test Java files use `com.example.planningpoker`.
  The main class is `PlanningPokerApplication`; Maven artifact is `planningpoker`,
  application name is `planningpoker`, and version remains `1.4.0-SNAPSHOT`.
- Product events use `pp:`; globals use `__pp...`; the language bridge is
  `pp:lang-change`. Payloads, event targets, server commands and data fields remain
  unchanged. Cached script URLs were incremented where required.
- A shared synchronous storage reader migrates valid values before CSS loads.
  Canonical writers use the new names; old settings remain available for rollback.
- English/German messages, duplicate About definitions, template fallbacks,
  knowledge-base text, manifest, JSON-LD name and Open Graph site name use
  RBS' Planning Poker. Professional estimation terminology and the About synonym
  remain. Public URLs and canonical metadata are unchanged.
- Tests, configurations, scripts and workflow secret expressions prefer `PP_*`
  with `EP_*` fallbacks. Existing secrets were not modified. Manual production
  workflow runs now fail explicitly if neither naming scheme supplies both URLs.
- Private npm package is `pp-noxvobiscum-guardrails`; lockfile root names match.
  CI build artifact name is `planningpoker-app`.
- Current documentation and both BRIEFING guards agree. README retains its
  UTF-16LE BOM. Historical audit, backlog, archives and infrastructure examples
  retain their historical/external identifiers.

## Additional validation corrections

The new exactly-once test exposed duplicate toggle handlers in the unchanged
checkpoint scripts (one click produced two identical events). The menu now shares
the existing `__bound` ownership marker with the room fallback. Only the owner
dispatches; payloads, targets and game rules are unchanged. This is isolated in
commit `216d053` and covered for all five switches, including menu reopening.

Existing browser tests also had obsolete selectors, assumptions that coffee was
selected by default, a sequence event sent to the wrong target, reused room
identities and host-election timing races. Tests now establish those preconditions
and assert the current UI/server contract. Assertions were not replaced by skips.
The helper guard accepts the existing re-export modules and distinguishes direct
helper calls from module exports inspected by ENV compatibility tests.

## Legacy compatibility retained

| New key/name | Legacy fallback | Notes |
| --- | --- | --- |
| planningpoker-theme | estpoker-theme, ep-theme, theme, themeMode | First valid value in this order after the canonical key; light/dark/system only |
| pp-ui-style | ep-ui-style | dev/clean only |
| pp-name, pp-room | ep-name, ep-room | Existing landing values preserved |
| pp-cid | ep-cid | Read before generating a new identity; retained across reload |
| pp-pf-ok:&lt;room&gt;:&lt;name&gt; | ep-pf-ok:&lt;room&gt;:&lt;name&gt; | Exact suffix retained |
| pp-flash | ep-flash | One-shot: both aliases consumed to avoid repetition |
| PP_BASE_URL, PP_ROOM_URL | EP_BASE_URL, EP_ROOM_URL | Test helpers/configuration and workflow secrets |
| PP_MENU_JS, PP_ROOM_JS, PP_CHECK_LOG | EP_MENU_JS, EP_ROOM_JS, EP_CHECK_LOG | Menu contract guard |

New writes do not update old aliases. Rollback restores the preserved older
settings, not necessarily changes made after migration. The neutral `lang` key
and server-side session mechanism remain unchanged. Old event names are not
dual-dispatched; test-only listeners explicitly check that they stay silent.

## Intentionally unchanged

- `ep.rbsnet.at`, canonical/sitemap/robots/JSON-LD/social URLs, WebSocket origins
  and SEO domain assertions.
- GitHub repository/remote, Koyeb identifiers, FTPS base directory and JSON room
  filenames, accounts, service aliases, image/repository names and backup paths.
- External `ep-api.noxvobiscum.at`; no DNS/TLS/Search Console changes.
- No database migration or changes to neutral room/participant/vote/topic fields.
- `ep-presence:<encoded-name>` is still writer-only and was not migrated.
- `src.zip`, `filetree.txt`, `BRIEFING-ad5aa84.md`, historical backlog/audit and
  the unused CSS copy retain their original contents.

## Authorized transport follow-up

After the validation checkpoint, the user explicitly authorized targeted correction
without changes to fundamental functionality. `GameService.sendText` now serializes
text writes on the existing session object. Identity, state, broadcast, roster,
heartbeat, kick and redirect messages all use this same path. Payload construction,
recipients, game state and close/error behavior remain unchanged. There is no new
queue, buffering/drop policy or global connection lock.

The concurrent identity/broadcast regression test failed on the original code and
passes with the correction. Tests also verify that one busy session does not block
another and that closed-session handling/IOExceptions retain their contract.
Maven verify now passes **29 tests**.

The remaining targeted failures were test setup races: navigating first did not
ensure connecting first, and an existing empty card container was mistaken for a
ready room. Tests now wait for the server-confirmed host role and actual cards.
The shared two-client helper establishes the host before joining the guest, uses
the canonical ENV helper, and readiness failures are no longer swallowed. Six
targeted tests now pass without retries. Full-suite follow-up is recorded below.

## Original validation stop (resolved by the authorized follow-up above)

- Final browser validation: 91 passed, 7 failed. During this run the server reports
  `IllegalStateException: ... [TEXT_PARTIAL_WRITING]` and closes sessions with code
  1011. One stack passes through `GameService.sendIdentity:1007` and
  `GameWebSocketHandler.afterConnectionEstablished:126` (local server log at
  2026-10-10 13:36:49 +02:00). Both Java files were compared with the checkpoint
  and are byte-equivalent after package-name/newline normalization. This is
  evidence of a transport/concurrency issue in unchanged code, not proof that it
  caused every failed test. At that checkpoint, no transport fix had been
  attempted. The user subsequently authorized the correction described above.
- Existing E2E helpers raced host assignment (`openTwoClients` navigated both
  clients simultaneously) and accepted DOM presence before server readiness.
  The follow-up corrects these preconditions without retries or skipped assertions.

## Decision required / deferred

- `ep.e2e`, `ep.default-language`, `ep.default-sequence`, `ep.features.*` and
  `ep.flags.*` in the E2E profile and Spring metadata have no demonstrated runtime
  reader. Keep until their purpose/removal is separately decided.
- `ep.buildTag` in npm launch commands likewise has no demonstrated runtime
  consumer. No blind rename or functional cleanup was performed.
- The legacy/test fallback events now named `pp:topic:set`, `pp:reveal` and
  `pp:reset` still have no matching consumer. Their original fallback behavior was
  preserved; deciding whether to remove or implement them is separate work.
- Duplicate English About message definitions remain structurally unchanged;
  both brand definitions were updated. Consolidation is optional future cleanup.
- Hard mode remains per-client state, as before; it was not converted to a
  room-wide persisted setting during rebranding.

## Validation

- Final full Playwright run: **98 passed, 0 failed, 0 skipped**, no retries,
  4.3 minutes (`websocket-fix-full-browser.log`). Tests used the local application
  at port 18088 with persistent snapshots disabled, including Chromium/Firefox
  geometry, both visual styles, storage migration, SEO and game flows.
- No `TEXT_PARTIAL_WRITING` conflict appeared in `websocket-fixed-server.log`.
  One separate close/send race was logged during browser teardown: a connection
  closed after the open check but before its send completed, producing
  `IllegalStateException: Message will not be sent because the WebSocket session
  has been closed`. No test failed from it. This existing close/error behavior
  remains unchanged; the correction serializes writes, not remote disconnects.
  Optional follow-up: handle this narrowly without suppressing unrelated errors.
- The dedicated local test server was stopped after verification.
- Maven `verify`: BUILD SUCCESS, 29 tests, zero failures/errors/skips after the
  authorized transport correction (`websocket-fix-maven.log`). Original rebranding
  build had 26 tests; the transport follow-up adds three regression tests.
- `npm run ci:verify`: menu contract guard, E2E helper guard and TypeScript check pass.
- BRIEFING pre-commit integrity guard passes; CI title matches it exactly.
- Pre-fix full browser run: **91 passed, 7 failed, 0 skipped** (98 tests, 3.9 min,
  no retries). Log: `rebrand-final-verified-browser.log`.
  Failures: control geometry Dev/light and Clean/light at 1280px; prod auto-reveal;
  reset-flow; sequence-change; specials-ui; topic show/hide propagation.
  The geometry failures are missing cards after room load, not measured layout
  differences. Earlier full run: 87/97 passed. Targeted corrections subsequently
  passed, but the later full run revealed these additional/intermittent failures.
- All five switch events pass exactly-once assertions, including menu reopening;
  the legacy event namespace remains silent (`rebrand-final-events.log`: 3 passed).
- Eight explicit storage migration checks pass, including pre-CSS theme/style,
  canonical precedence, legacy fallback, landing values, CID/preflight/reload and
  both flash types consumed exactly once.
- Rollback simulation executed the original checkpoint head bootstrap against
  migrated browser storage: light/Clean restored; legacy name/room/CID readable.
  This is not a full old-backend deployment test.
- Core interaction coverage is automated through real browser UI actions:
  create/join, vote/reveal/reset, host transfer, spectator, topic, special cards,
  auto-reveal, hard mode, language, themes and styles. No separate human/manual
  exploratory session or production test/deployment was performed.
- Initial failures were recorded and corrected, rather than ignored: one new test
  selector and a CSS preload-scanner timing assumption; existing obsolete test
  assumptions; the independently reproduced duplicate handler. The initial Java
  clean-test context failure passed on an unchanged rerun and subsequent builds.

## Residual search

The line-level inventory follows. No unclassified migration misses remain.
Unbound `ep.*` properties above were searched separately because the requested
patterns do not include `ep.`. Completion/handoff documents contain historical
names deliberately as migration evidence, and are excluded from self-inventory.

Scope: all tracked text files (README decoded as UTF-16LE), case-insensitive search for every requested pattern. 258 matching lines; zero unclassified misses. Binary src.zip is unchanged and retains historical names (see original audit).

| File | Lines | Category | Reason |
| --- | --- | --- | --- |
| `.github/workflows/e2e.yml` | 16, 18, 19, 44, 74 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `README.md` | 33, 34, 45, 46 | intentional | Existing repository, infrastructure, installation or external API identifier |
| `docs/BRIEFING.md` | 341, 347, 351 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `docs/BRIEFING.md` | 344 | legacy compatibility | Legacy storage documentation |
| `docs/BRIEFING.md` | 348 | intentional | Writer-only presence key, no migration requested |
| `docs/DEPLOYMENT.md` | 7, 87, 109, 126, 158, 172, 199, 204, 213, 223, 228, 248, 281, 282, 287, 288, 309, 315, 324, 329, 334, 341, 350, 351, 352, 367, 368, 373, 378, 396, 400, 403, 603, 708, 725, 777, 835 | intentional | Existing repository, infrastructure, installation or external API identifier |
| `docs/DEVELOPER-GUIDE.md` | 64, 65, 110, 683 | intentional | Existing repository, infrastructure, installation or external API identifier |
| `docs/E2E-TESTING.md` | 30, 31 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `docs/E2E-TESTING.md` | 135 | intentional | Substring match in unrelated term or vendor wrapper |
| `docs/PLANNING-POKER-REBRAND-AUDIT.md` | 1, 24, 30, 32, 33, 34, 36, 37, 47, 48, 49, 50, 51, 52, 53, 56, 57, 63, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 78, 79, 80, 88, 89, 91, 92, 93, 94, 95, 96, 97, 100, 110, 111, 112, 113, 114, 115, 117, 130, 132, 141, 142, 164, 174, 177, 190, 191, 192, 194, 211, 212, 214, 215, 217, 227, 228, 229, 230, 231, 241, 247, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 373, 374, 375, 376, 377, 378, 379, 380, 381 | historical | Preserved historical inventory, archive or unused CSS copy |
| `docs/USER-GUIDE-EN.md` | 396, 397 | intentional | Existing repository, infrastructure, installation or external API identifier |
| `docs/USER-GUIDE.md` | 396, 397 | intentional | Existing repository, infrastructure, installation or external API identifier |
| `filetree.txt` | 1, 61, 123, 172, 192, 271, 331 | historical | Preserved historical inventory, archive or unused CSS copy |
| `koyeb.yaml` | 2 | intentional | Existing repository, infrastructure, installation or external API identifier |
| `mvnw.cmd` | 33, 38, 39 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `playwright.config.ts` | 21 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `scripts/check-menu-toggle-events.js` | 22, 23, 24 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `scripts/rooms-smoke.sh` | 5 | intentional | Existing repository, infrastructure, installation or external API identifier |
| `scripts/run-and-tunnel.sh` | 90, 91 | intentional | Substring match in unrelated term or vendor wrapper |
| `src/main/java/com/example/planningpoker/controller/GameController.java` | 93, 129 | intentional | Substring match in unrelated term or vendor wrapper |
| `src/main/java/com/example/planningpoker/service/GameService.java` | 430 | intentional | Substring match in unrelated term or vendor wrapper |
| `src/main/resources/messages.properties` | 208, 300 | intentional | Permitted Planning/Scrum Poker synonym |
| `src/main/resources/messages_de.properties` | 43 | intentional | Substring match in unrelated term or vendor wrapper |
| `src/main/resources/messages_de.properties` | 214 | intentional | Permitted Planning/Scrum Poker synonym |
| `src/main/resources/static/js/room.js` | 141, 2341 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `src/main/resources/static/js/room.js` | 1975 | intentional | Writer-only presence key, no migration requested |
| `src/main/resources/static/js/storage.js` | 19, 21, 24, 29 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `src/main/resources/static/styles - Kopie.css` | 2, 561 | historical | Preserved historical inventory, archive or unused CSS copy |
| `src/main/resources/static/styles.css` | 630 | intentional | Substring match in unrelated term or vendor wrapper |
| `src/main/resources/templates/about.html` | 28 | intentional | Permitted Planning/Scrum Poker synonym |
| `src/main/resources/templates/index.html` | 72, 73 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `tests/env-compatibility.spec.ts` | 12, 13, 15, 31, 36, 37, 38 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `tests/prod-autoreveal.spec.ts` | 9, 10 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `tests/prod-smoke.spec.ts` | 8, 9 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `tests/pw.e2e.config.ts` | 5 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `tests/storage-migration.spec.ts` | 3, 9, 10, 11, 33, 34, 43, 44, 46, 48, 65, 66, 73, 75, 88, 92 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `tests/toggles.spec.ts` | 129, 149 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |
| `tests/utils/env.ts` | 3, 6 | legacy compatibility | Legacy ENV/storage reader, fixture or compatibility assertion/documentation |

Supplemental Decision required references: `src/main/resources/application-e2e.properties:6-17`, `src/main/resources/META-INF/additional-spring-configuration-metadata.json:50-59`, and `package.json:16-17` (unbound `ep.*` / `ep.buildTag`).
