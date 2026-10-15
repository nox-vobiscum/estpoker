# Changelog

This file summarizes completed product changes. Detailed implementation notes and
temporary validation reports may be removed after the documentation consolidation.

## Unreleased

_No unreleased changes._

## 2026-10-15 — Post-redesign UX release

Production commit: `e84cecd`.

- Added a dedicated responsive estimation-topic panel with a clear bilingual
  heading, prominent wrapping title, blue clipboard icon and optional external
  ticket link while retaining host-only edit and delete controls.
- Fixed the empty-topic editor so Save and Cancel reliably close it by removing
  overlapping topic action handlers.
- Replaced the room's four informational FAQ cards with one accessible,
  bilingual guide that is collapsed by default and documents the existing room
  workflow and settings.
- Added a clearly visible individual Leave room action below the room guide.
  Hosts retain Close room for everyone in the menu, while guests see Leave room.
  Leaving follows the existing navigation, disconnect and host-transfer path.
- Added a compact semantic participant heading with a live count of the rows
  currently displayed. Host, spectator and disconnected rows remain counted;
  removed rows do not.
- Matched the participant heading typography to the discreet estimation-topic
  heading in both Dev and Clean interface styles.
- Completed and deployed post-redesign change requests CR-001 through CR-004.

### Validation

- GitHub CI and the complete GitHub Playwright workflow passed for `e84cecd`.
- Koyeb deployed the commit successfully to `https://planning-poker.at`.
- The production smoke covered participant lifecycle/count updates at 375 and
  1280 px plus two-user voting, reveal and reset in Dev and Clean styles
  (5 focused tests passed).

## 2026-10-14 — Major Redesign production release

Release baseline: `major-redesign-prod-v1` (`d42b022`), followed by invitation
hotfix `2518de2`.

### Added

- Introduced the shared responsive app header, centralized UI preferences and a
  responsive settings menu for language, theme and Dev/Clean interface style.
- Integrated the approved Planning Poker brand assets, favicons, PWA icons and
  manifest metadata.
- Added per-tab return-to-room navigation, a bilingual imprint page and
  privacy-conscious analytics limited to public content pages.

### Changed

- Refined the landing/join experience, room controls, settings hierarchy,
  responsive content visibility, shape language and public-page typography.
- Made the header full width while retaining centered game and content areas.
- Improved keyboard, screen-reader and reduced-motion behavior, including card
  selection state and result announcements.

### Fixed

- Prevented vote-selection resynchronization loops and false participant sleep
  transitions during overlapping WebSocket reconnects.
- Aligned the result display, voting grid and animated participant vote chips on
  their intended horizontal axes.
- Corrected the invitation heading so its apostrophe renders normally instead
  of exposing a Unicode escape sequence.

### Validation

- Completed the major-redesign regression with 195 distinct Playwright tests,
  Maven verification and project CI guards.
- The production release and invitation hotfix passed GitHub CI; the release
  smoke covered two participants, voting, reveal, reset, header, menu and room
  return navigation on `https://planning-poker.at`.

## 2026-10-11 — Production domain and repository migration

- Switched the canonical production domain, social metadata, structured data,
  sitemap, robots configuration and production checks to
  `https://planning-poker.at`.
- Retained the old origin during the controlled transition, then removed legacy
  Estimation Poker environment, storage, event and frontend compatibility after
  the cutover.
- Updated active repository references to `nox-vobiscum/planning-poker` and
  documented the production DNS/TLS architecture.
- Corrected public-page footer spacing so landing and About content remain fully
  visible.

## 2026-10-10 — Planning Poker product rebrand

Production checkpoint: `planning-poker-rebrand-prod-v1`.

- Renamed the product from Estimation Poker to Planning Poker across active UI,
  Java packages, application identifiers, browser storage and frontend events.
- Preserved room, voting, persistence and WebSocket behavior throughout the
  staged migration.
- Serialized WebSocket text writes per connection to prevent concurrent-send
  transport failures and strengthened role/readiness coverage in browser tests.
- Completed the rebrand verification with Maven, CI guards and 98 Playwright
  tests without failures or skips.
