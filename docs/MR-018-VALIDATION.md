# MR-018 final regression validation

Started 2026-10-14 on `feature/major-redesign`, baseline `7499cf4`.
Story gate approved by the user with Astra selected. No deployment or push is part of this story.

## Resumable checkpoints

- [x] Gate and clean baseline verified; MR-017 complete.
- [x] Java backend unchanged against `pre-major-redesign` (`git diff -- src/main/java`).
- [x] Maven verify and npm CI guards (both exit 0).
- [x] Playwright shard 1/3: 65 passed in 1.9m, zero retries/skips (report: `target/mr018-shard1.json`).
- [x] Playwright shard 2/3 initial run: 65 passed, 1 failed in 2.7m, zero retries/skips (`target/mr018-shard2.json`). Failure and targeted correction recorded below; verification pending.
- [x] Playwright shard 3/3: 64 passed in 1.9m, zero retries/skips (`target/mr018-shard3.json`); finished during the usage-limit interruption and verified after resume.
- [x] Frozen-contract coverage and failure review.
- [x] Final documentation and DONE status; delivered in the separate MR-018 commit.

## Execution plan

Run the default Playwright suite in three sequential shards against the local preview only.
Set both `PP_BASE_URL` and `PP_ROOM_URL` to localhost so environment-gated smoke tests execute.
Use `--retries=0`, separate output directories and JSON/log reports per shard under `target/`.
Record results here immediately after each block; do not silently retry failures or weaken assertions.

## Known limitations to assess

- Existing topic-editor defect and stale-room-return limitation remain documented baseline risks.
- Live FTPS and manual screen-reader speech are not exercised by local browser tests.
- MR-017 covers Chromium and Firefox; Safari/WebKit is outside its declared scope.

## Results

Maven verify and `npm run ci:verify` passed. The preview was stopped for Windows JAR repackaging and restarted from the verified build. The default Playwright discovery contains 195 tests in 57 files. Application files have not been changed for this story.

Maven: 30 tests, zero failures/errors/skips. The initial Playwright launch failed before test execution because PowerShell expanded the comma in the reporter argument; quoting `'--reporter=line,json'` corrected the invocation.

Shard 2 findings resolved: `prod-autoreveal` assumed participant DOM order equals join order; the failure snapshot showed the correct Host=1, B=5, A=3 and average=3. Name-to-vote assertions now verify each participant independently of order, while retaining the exact chip count and average checks. The old `persistence` test only logged an unconfirmed auto-reveal state and never asserted the reloaded setting. It now uses ordinary checkbox interaction, verifies the server-synchronized setting before/after reload, guest permissions, automatic reveal and average on both clients.

The first correction run passed prod-autoreveal but exposed a mistake in the new test: reset visibility was asserted for the guest as well as the host. Existing application code intentionally restricts reset to the host. The corrected test explicitly verifies host-visible/guest-hidden reset and visible results on both clients; its final run passed. No application code changed and no unexplained failures remain.

Final evidence: all 195 distinct default-suite tests have passing results (194 initially, corrected prod-autoreveal separately; strengthened persistence separately). Automatic retries, skips and flaky results: zero. Reports: `target/mr018-corrections.json` and `target/mr018-persistence-final.json` retain the targeted runs. npm CI guards passed after the tuple typing correction; Maven's 30 tests passed against the unchanged application build. The usage-limit interruption occurred before that typing edit; the edit and all outstanding results were reconciled on resume.

## Frozen-contract evidence map

All shards and required targeted corrections completed. This is a combined validation record, not a claim that the first full run was entirely green.

| Contract | Relevant evidence |
| --- | --- |
| Create/join/invite, duplicate names | landing-form, invite-name-check, duplicate-name-suffix, prod-smoke |
| Participants and identity | participants-list, host-label, storage (CID/preflight), reload-stays-in-room |
| Host permissions/transfer/close/kick | rebrand-core-flow, host-and-close, kick-flow, room-return |
| Vote/reveal/reset and results | cards-reveal, reset-flow, prod-deck, specials-stats, result-aria-* |
| Sequences and specials | sequence-change, menu-sequence, specials-ui, specials-payload, infinity-visibility |
| Auto-reveal/hard mode/spectator/topic | auto-reveal, persistence, rebrand-core-flow, participation-spectator, prod-participation, topic-* |
| WebSocket protocol and synchronization | Real multi-client browser flows, specials-payload; unchanged Java backend and reviewed room.js diff |
| Backend/endpoints/persistence/FTPS format | Unchanged Java sources; 30 Maven tests including room CRUD/password, stored-room persistence and FTPS JSON serialization |
| Preferences/menu ownership and UI | ui-preferences, preference-parity, ui-style, theme-runtime-menu, lang-runtime*, menu-*, settings-container, npm event guards |
| Responsive presentation/accessibility/SEO | accessibility, control-geometry, mobile-content-visibility, shape-language, clean-surfaces, brand-assets, seo |

The `room.js` baseline diff is limited to MR-019 return-context hooks and MR-016 focus/ARIA/localized announcements. No changed vote calculations, wire messages or game rules were found. Local FTPS tests cover serialization/service behavior, not a connection to the production FTPS server.

Coverage limits: kick-flow checks the confirmation and cancellation path, not a confirmed removal end-to-end. Topic save/clear/visibility tests pass, but do not reproduce the separately reported manual-empty-input close defect. Protocol coverage exercises existing flows and selected payloads, not every possible wire message. These are explicit coverage limits, not skipped tests or proof that the known backlog issues are fixed. No live production, external storage or deployment changes were made.
