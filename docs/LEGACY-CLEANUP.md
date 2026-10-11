# Legacy cleanup verification

Date: 2026-10-11. Runtime naming uses planningpoker, planning-poker, PP_* and pp-* only.
No game rules, FTPS settings or room data structures changed.

## Removed compatibility

- Previous ENV aliases, storage/theme/CID/preflight/flash aliases and old-origin
  allowlisting removed; current keys and client identity behavior preserved.
- Write-only presence key aligned with the current namespace. Cache versions
  incremented for storage and room scripts.
- Unread E2E properties and build-tag argument removed after checking readers.
- Completed migration script and compatibility/redirect suites retired.
  Current storage, ENV, domain, event and room-flow checks remain.
- Active service manifest and documentation examples use current names.
  No provider resources, registry packages or filesystem paths were migrated.
- CI uses only PP-named overrides and public production defaults; no retired
  secret is needed to run the production smoke tests.

## Validation before deployment

- Maven verify: 30 passed, no failures/errors/skips; package built.
- npm ci:verify: guards and TypeScript passed.
- 44 distinct targeted browser cases covered successfully: initial run passed
  43; one new storage test incorrectly expected null after the existing menu
  normalized invalid theme input to system. Corrected that expectation and
  reran all 5 storage tests successfully. No production workaround or test skip.
- Historical documents and archives preserved, except an explicit historical
  banner on the completed domain migration record. Backlog ticket committed
  separately from the cleanup.

Logs: target/cleanup-maven.log, target/cleanup-guards-final.log,
target/cleanup-browser.log, target/cleanup-storage-final.log (local artifacts).

## Production verification

Cleanup commit `e1029a8` was pushed and its new storage script delivered.
CI build passed. Nine live domain/SEO checks and the multi-client host/voting
flow passed. The retired WebSocket origin is rejected with HTTP 403.
All five current storage tests pass live after removing a CSS-interception wait
that could deadlock the preload scanner; the test now observes the stylesheet
load event without blocking resources. No application change was required.
CI production E2E reported 7 passed / 1 failed: the previously observed coffee
button interception in prod-deck. This separate menu issue was not modified;
the workflow's existing continue-on-error can still display overall success.

## Remaining matches

Case-insensitive search across tracked text (README decoded as UTF-16LE), including
all requested old-name patterns and standalone ep. Binary src.zip is classified
as an archive. Generated output, dependencies and .git history are not active code.
This report is excluded from its own inventory.

| File | Lines | Category | Reason |
| --- | --- | --- | --- |
| docs/BACKLOG.md | 41 | historical | Dated audit, completed migration record, backlog or archived copy |
| docs/DOMAIN-MIGRATION.md | 8, 38, 89, 151 | historical | Dated audit, completed migration record, backlog or archived copy |
| docs/E2E-TESTING.md | 134 | external unrelated | Substring matches in keep/deep/step/sleep/sep or Maven wrapper variables |
| docs/PLANNING-POKER-REBRAND-AUDIT.md | 1, 24, 30, 32, 33, 34, 36, 37, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 63, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 78, 79, 80, 88, 89, 91, 92, 93, 94, 95, 96, 97, 100, 104, 110, 111, 112, 113, 114, 115, 117, 130, 132, 141, 142, 164, 174, 177, 190, 191, 192, 194, 211, 212, 214, 215, 216, 217, 224, 227, 228, 229, 230, 231, 241, 247, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 373, 374, 375, 376, 377, 378, 379, 380, 381 | historical | Dated audit, completed migration record, backlog or archived copy |
| docs/PLANNING-POKER-REBRAND-PHASE-1.md | 20, 47, 74, 75, 76, 77, 78, 79, 80, 81, 90, 94, 96, 138, 139, 141, 197, 198, 244 | historical | Dated audit, completed migration record, backlog or archived copy |
| filetree.txt | 1, 61, 123, 172, 192, 271, 331 | historical | Dated audit, completed migration record, backlog or archived copy |
| mvnw.cmd | 33, 38, 39 | external unrelated | Substring matches in keep/deep/step/sleep/sep or Maven wrapper variables |
| scripts/rooms-smoke.sh | 5 | external unrelated | Independent external API hostname; not the product domain |
| scripts/run-and-tunnel.sh | 90, 91 | external unrelated | Substring matches in keep/deep/step/sleep/sep or Maven wrapper variables |
| src.zip | binary | historical | Unchanged source archive |
| src/main/java/com/example/planningpoker/controller/GameController.java | 93, 129 | external unrelated | Substring matches in keep/deep/step/sleep/sep or Maven wrapper variables |
| src/main/java/com/example/planningpoker/service/GameService.java | 430 | external unrelated | Substring matches in keep/deep/step/sleep/sep or Maven wrapper variables |
| src/main/resources/messages.properties | 208, 300 | intentional fachlich | Planning Poker synonym or ordinary deep-link wording |
| src/main/resources/messages_de.properties | 43, 214 | intentional fachlich | Planning Poker synonym or ordinary deep-link wording |
| src/main/resources/static/styles - Kopie.css | 2, 561 | historical | Dated audit, completed migration record, backlog or archived copy |
| src/main/resources/static/styles.css | 630 | external unrelated | Substring matches in keep/deep/step/sleep/sep or Maven wrapper variables |
| src/main/resources/templates/about.html | 28 | intentional fachlich | Planning Poker synonym or ordinary deep-link wording |

Missed cleanup files: 0.
