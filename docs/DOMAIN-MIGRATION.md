# Domain migration: ep.rbsnet.at → planning-poker.at

Prepared 2026-10-11. **No push, deployment, DNS change or redirect authorized.**
Production baseline: `5634377`; branch: `prep/planning-poker-domain`.
The existing local `docs/BACKLOG.md` change is unrelated and remains untouched.

## Deployable preparation

- Default and prod WebSocket allowlists accept both exact HTTPS origins.
  No additional CORS/host restriction was found. Client WebSockets already use
  `location.host`; invite URLs use the current origin. No JS changes are needed.
- Check Koyeb environment overrides (especially `APP_WEBSOCKET_ALLOWED_ORIGINS`)
  before deployment: an override must also contain both origins.
- All canonical/social/JSON-LD/crawl URLs still use `https://ep.rbsnet.at`.
- No redirect implementation is active or introduced by this preparation.
- The scripts and opt-in test configs can be deployed without enabling cutover.

## Prepared cutover bundle

`node scripts/prepare-domain-cutover.cjs` prints a dry-run inventory.
Only after explicit Go-Live approval, `--apply` prepares a separate commit:

- `templates/fragments/head.html`: canonical, og:url (via canonical), both image
  URLs and JSON-LD URL → `https://planning-poker.at`.
- Static `robots.txt` and `sitemap.xml`: same new origin; paths unchanged.
- `tests/seo.spec.ts`: new default expected canonical origin.
- `.github/workflows/health-monitoring.yml`: new health target.
- README and active API/architecture/briefing/deployment/user documentation:
  live examples follow the new domain. Old-origin allowlist examples remain
  unchanged because the old origin must stay accepted.

The script uses an explicit file list, preserves README's UTF-16LE BOM and does
not touch archives, audit reports, backlog, storage or provider identifiers.
It fails if an expected file no longer contains the old domain. Review the diff
before committing; this is not a deployment command. Existing historical test
comments can retain their old production example. No dynamic SEO system added.

## External prerequisites — blocking gates

1. **Koyeb:** add `planning-poker.at` to the same existing App/service. Keep the
   old domain, names, routes, instance topology and storage. Record the actual
   DNS target shown by Koyeb; do not infer an IP or reuse a temporary resolved IP.
2. **all-inkl / apex DNS:** the desired host has no `www`. all-inkl's published
   instructions do not support a CNAME at the zone apex; Koyeb also documents
   limitations and suggests apex → www redirection. That suggestion does NOT
   meet this requested canonical host. Ask support to confirm a supported apex
   solution (or separately agree on another DNS provider/setup). Do not silently
   switch to www, move nameservers, create guessed A/AAAA records or configure
   a reverse proxy. Preserve existing MX/TXT and unrelated DNS records.
3. **TLS:** wait for Koyeb domain Active and valid HTTPS for the exact new host.
   Check DNS propagation and CAA if certificate issuance fails. Do not bypass
   certificate errors in tests. Retain TLS on the old domain as well.
4. **Redirect provider:** determine where requests to the old hostname are
   actually terminated (CDN/edge/Koyeb). No controllable redirect configuration
   exists in this repo; confirm the provider supports the contract below before
   activating anything. A DNS record alone cannot implement an HTTP redirect.

Sources checked during preparation:
[Koyeb custom domains](https://www.koyeb.com/docs/run-and-scale/domains),
[all-inkl CNAME instructions](https://all-inkl.com/wichtig/anleitungen/providerwechsel/einrichtung/dns/cname_178.html).

## Redirect contract — disabled until separate approval

At the confirmed HTTP edge, match **only** host `ep.rbsnet.at`.
For ordinary GET/HEAD page requests return **301** with Location composed of
`https://planning-poker.at` + the original raw path + original raw query.
Preserve percent encoding, repeated parameters, room code and participant name.
Never derive the destination host from user input. Never match the new host.

Examples:

| Old request | Required Location |
| --- | --- |
| `/about?lang=de` | `https://planning-poker.at/about?lang=de` |
| `/room?roomCode=A%2BB&participantName=A%20B` | `https://planning-poker.at/room?roomCode=A%2BB&participantName=A%20B` |
| `/invite?roomCode=ABC&x=1&x=2` | `https://planning-poker.at/invite?roomCode=ABC&x=1&x=2` |

Explicitly bypass `/gameSocket` and every WebSocket upgrade, continuing to proxy
them to the same application with Origin preserved. Existing sockets must not
be forcibly disconnected. Existing tabs may still request APIs/assets: retain
those old-host routes during the transition; do not blanket-301 POST/API traffic.
Health probes must keep working. The /* migration describes page URLs, not a
permission to redirect WebSockets or change HTTP methods. If the provider cannot
express these exceptions, stop and agree a separate implementation.

Both domains must reach the same application/room state. Browser localStorage,
sessionStorage and cookies are origin-scoped: preferences and participant CID do
not automatically transfer to the new domain. Legacy-key fallbacks do not solve
cross-domain storage. Do not promise seamless host identity across an open-room
switch; choose a quiet window and finish active sessions before redirecting.
No storage migration or new identity mechanism is part of this preparation.

## Tests and commands

No migration check is silently skipped. These are explicit suites outside the
default `*.spec.ts` discovery; running one before its prerequisites is an error.

```powershell
# After DNS/TLS + preparation deployment, BEFORE canonical switch:
npx playwright test -c tests/domain-ready.config.ts

# After approved canonical deployment, BEFORE redirect activation:
npx playwright test -c tests/domain-cutover.config.ts seo.spec.ts ready.check.ts

# AFTER redirect activation (includes exact 301 path/query checks + old WS 101):
npx playwright test -c tests/domain-cutover.config.ts
```

Readiness defaults to `https://planning-poker.at`, validates TLS, expects old
canonicals, checks Home/About, metadata/images/JSON-LD/crawl files/noindex and a
real room WebSocket with voting. The cutover suite expects new canonicals and
adds redirect tests. `PP_DOMAIN_TEST_URL` is a local rehearsal override only;
unset it for real DNS/TLS verification. No retry or TLS-ignore setting is used.
The Java smoke test verifies old/new Origin handshakes and rejects unrelated
origins. Existing SEO tests also support explicit `PP_CANONICAL_ORIGIN`.

## Go-live order (requires explicit user approval)

1. Resolve apex DNS and redirect-provider prerequisites; retain old domain/TLS.
2. Deploy only the two preparation commits after approval; check any Koyeb ENV
   overrides. Run readiness against the new domain while old canonical remains.
3. Obtain final Go-Live approval. Create a fresh annotated production checkpoint.
4. Run cutover script with `--apply`, review, build/test, commit separately and
   deploy SEO/monitoring changes. Run the pre-redirect cutover command above.
5. Update GitHub `PP_BASE_URL` / `PP_ROOM_URL` secrets to new host, preserving
   the room URL's path/query. Update external monitors; keep EP_* fallbacks.
6. Only after successful new-host verification, enable the provider's reviewed
   301 rule with WebSocket/API exceptions. Run the full cutover suite.
7. Verify both Search Console properties, submit the new sitemap and use the
   available address-change procedure after redirects are working. Monitor
   indexing/errors, old links, WebSockets, and certificate renewal.

Rollback: disable the external redirect first, keep both hosts/TLS and allowlists,
revert the separate cutover commit and restore monitor/secret targets. Cached
301s may persist in browsers, so keep the new host operational during rollback.
Do not remove either domain or legacy fallbacks in this phase.

## Validation record

- Maven verify: **30 tests passed**, zero failures/errors/skips; JAR packaged.
- `npm run ci:verify`: contract/helper guards and TypeScript check passed.
- Local readiness suite: **9 passed**, old canonical domain retained.
- Isolated local cutover rehearsal: **9 passed**, new SEO URLs verified using
  copied resources only. Source templates/static files retain old URLs.
- Script dry run and apply in the isolated copy passed; README BOM preserved.
- Actual new-domain DNS/TLS and external 301 tests were **not executed** because
  their provider prerequisites and Go-Live approval are outstanding. No failed
  check was skipped or retried into a pass. These remain release gates.
- Production was reachable at `/healthz`; remote main matched `5634377`.
- Logs are ignored local artifacts: `target/domain-maven.log`,
  `target/domain-guards.log`, `target/domain-ready.log`,
  `target/domain-cutover-rehearsal.log`. Both dedicated test servers stopped.
