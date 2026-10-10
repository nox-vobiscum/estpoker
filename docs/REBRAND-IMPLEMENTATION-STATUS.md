# Rebranding implementation: resumable handoff

Updated: 2026-10-10. Status: implementation committed; validation incomplete.

## Rules that remain in force

- Work only on `rebrand/planning-poker`; do not merge, push, deploy or switch to main.
- Preserve `pre-planning-poker-rebrand` at
  `bd0afd381a03fa1528c401276a3ad0c53557de75`.
- Do not rename domain, repository, Koyeb, FTPS paths, external APIs or neutral data.
- Original request: `C:/Users/noxvo/.codex/attachments/7eff0e8b-f5c7-4146-bd79-4a5a70c2bb34/Pasted text.txt`.
- The request says STOP and report if a step becomes unexpectedly risky. This
  boundary was reached by final validation, not by an approval/usage error.

## Source of truth

Read `docs/PLANNING-POKER-REBRAND-PHASE-1.md` for all commits, completed work,
compatibility aliases, decisions, validation evidence and the complete categorized
residual search. `docs/PLANNING-POKER-REBRAND-AUDIT.md` is the historical audit and
is already committed. No implementation changes are left uncommitted.

Last implementation/test commit: `c99a486`; event ownership fix: `216d053`.
The later documentation checkpoint commits this handoff and the validation report.

## Verified results

- Maven verify: 26 passed; packaging after event ownership correction passed.
- npm ci:verify: both JS guards and TypeScript check passed.
- Explicit storage migration tests: 8 passed.
- Exactly-once event tests: 3 passed, including all five switches and reopening.
- Original checkpoint head bootstrap reads preserved legacy browser storage.
  This is a limited rollback simulation, not a full old-backend deployment test.
- Latest full Playwright suite: 91 passed / 7 failed / 0 skipped, no retries.
  Do not describe the phase as fully validated or release-ready.

## Exact point to continue

No further game/transport changes were made after discovering the risk. First
review the user's next instruction for authorization to investigate/fix transport
and remaining test synchronization beyond the original naming migration.

Seven failing cases in `rebrand-final-verified-browser.log`:

1. control-geometry: dev/light at 1280px (no cards after room load)
2. control-geometry: clean/light at 1280px (no cards after room load)
3. prod-autoreveal: checkbox state did not change
4. reset-flow: guest numeric card unavailable
5. sequence-change: host sequence change failed
6. specials-ui: palette chip not visible
7. topic-flow: Show/Hide propagation timeout

`rebrand-server-wiring.log` records `TEXT_PARTIAL_WRITING` transport exceptions and
1011 socket closures. Example at 13:36:49 +02:00:

```
java.lang.IllegalStateException: The remote endpoint was in state [TEXT_PARTIAL_WRITING]
  at StandardWebSocketSession.sendTextMessage(...)
  at GameService.sendIdentity(GameService.java:1007)
  at GameWebSocketHandler.afterConnectionEstablished(GameWebSocketHandler.java:126)
```

Both Java classes match the checkpoint exactly after package-name/newline
normalization. This does not establish the cause of every test failure. Existing
helpers also race host election (`openTwoClients` navigates both clients in
parallel) and sometimes check DOM existence before socket readiness. Do not mask
these failures with skipped checks, arbitrary sleeps or retries until green.

After scope is agreed, inspect retained Playwright traces/error contexts under
`test-results/` and server logs, correlate room IDs and timestamps, and reproduce
before changing code. Keep any transport correction separate from rebranding.

## Local commands and evidence

Local test server used port 18088 and disabled persistent snapshots. Its process
was stopped when saving this checkpoint. Start only if needed:

```powershell
java -jar target/planningpoker-1.4.0-SNAPSHOT.jar --server.port=18088 --features.persistentRooms.snapshot.enabled=false
$env:PP_BASE_URL='http://localhost:18088'
$env:PP_ROOM_URL='http://localhost:18088/room?roomCode=verification-smoke&participantName=Smoke'
npx playwright test
```

Stop the dedicated server before rebuilding its JAR on Windows. Do not stop the
user's IDE or other Java processes. The local server used Java 21.

Useful retained logs (ignored build/test artifacts, not committed):
`rebrand-final-maven.log`, `rebrand-final-guards.log`,
`rebrand-final-verified-browser.log`, `rebrand-server-wiring.log`,
`rebrand-final-events.log`, `rebrand-rollback.log`, `rebrand-baseline-events.log`.
Earlier runs and corrections are documented in the report; do not restart the
implementation or redo already committed naming/storage work.
