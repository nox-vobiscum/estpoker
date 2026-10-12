# MR-005: Preference baseline and decision gate

Date: 2026-10-12. Application revision: f74b834.
Status: Historical characterization retained; decision approved and MR-005 extraction completed.
No application code changed during this characterization; subsequent implementation is documented in the backlog.

## Method

The existing packaged application was started locally on port 18088 with persistent-room snapshots disabled.
Eight fresh Chromium contexts used en-US locale and the specified system color scheme.
An init-script MutationObserver recorded data-theme transitions; settled values were read after networkidle.
The storage-denied case replaced the localStorage getter with a throwing getter.
This records bootstrap DOM transitions and settled state, not proof that every transition paints visibly.
Raw local evidence: target/mr005-characterize.cjs and target/mr005-characterization.json (ignored artifacts).

## Observed baseline

| Case | Bootstrap theme | Settled theme / stored value | Style | Language | Errors |
| --- | --- | --- | --- | --- | --- |
| Missing preferences, system Light | dark | System / system | dev | en | none |
| Missing preferences, system Dark | dark | System / system | dev | en | none |
| Invalid theme/style | dark | System / system | dev | en | none |
| Saved dark + clean | dark | dark / dark | clean | en | none |
| Saved system, system Light | System | System / system | dev | en | none |
| Saved language de, query lang=en | dark | System / system | dev | de | none |
| No saved language, query lang=de | dark | System / system | dev | de | none |
| Storage access denied, system Light | dark | dark / unavailable | dev | en | two Storage blocked page errors |

System means no data-theme attribute, allowing OS-dependent CSS.
Sources: fragments/head.html early bootstrap, header-controls.js getTheme/init, menu.js getLang/init.
Saved language takes precedence over the server-rendered query locale in the tested case.
Saved valid theme/style values must retain their meaning; no persistence keys are to change.

## Required decision

MR-002, section "Existing default discrepancy: migration gate", states:
"If a single bootstrap rule would change an outcome, record the specific conflict and stop for a scoped decision instead of silently selecting a new default."

A consistent System fallback from the first bootstrap would preserve the ordinary settled behavior but change the initial dark attribute and the storage-denied settled result.
A consistent Dark fallback would change the ordinary settled default.
Preserving both phases would retain an explicit dark-to-system initialization transition.

Recommendation awaiting user approval:
- Missing/invalid/unavailable theme storage resolves to System from first bootstrap.
- Valid saved Light/Dark/System values remain unchanged.
- Missing/invalid UI style stays Dev.
- Language retains saved-language then rendered-locale precedence and de/en normalization.
- Storage denial must not abort initialization; use in-memory preferences without persistence.
- menuOpen and every dialog lifecycle responsibility stay exclusively in menu.js.

Alternative: preserve the existing dark-to-system bootstrap sequence and specify a separate storage-denied default.
At the characterization checkpoint no option had been approved; see Resolution below for the subsequent approval.

## Planned MR-005 work at the characterization checkpoint

After approval: add behavior fixtures for the approved rules, language response ordering and failed/blocked storage; extract the synchronous preference owner; convert menu/header into subscribers and action adapters; preserve event targets/payloads; run Maven/guards and relevant browser regressions; document and commit the completed story. No MR-006 work.
## Resolution and implementation

The user approved the recommended System default on 2026-10-12.
ui-preferences.js now owns theme/language/uiStyle, applies the approved defaults before CSS, uses existing keys and falls back to memory on storage denial.
Header/menu are subscribers and action adapters; menuOpen remains private to menu.js.
Generation checks prevent stale translation responses from overwriting the latest selection; failed loads can be requested again.
The forwarding window.setLanguage API and existing language event targets/payloads remain available.
See MR-005 Result in MAJOR-REDESIGN-BACKLOG.md for validation and the unresolved one-off topic-start timeout.