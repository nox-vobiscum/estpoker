# Rebranding-Audit: RBS' Estimation Poker → RBS' Planning Poker

Stand: 2026-10-09. Analysierter Commit: `bd0afd381a03fa1528c401276a3ad0c53557de75`.
Branch: `rebrand/planning-poker`. Rücksprung-Tag: `pre-planning-poker-rebrand`.

## Umfang und Integrität

Reines Repository-Audit ohne Umsetzung, Commit, Build, Testlauf, Deployment oder Infrastrukturzugriff. Alle 195 versionierten Pfade wurden inventarisiert; Textdateien einschließlich versteckter GitHub-/Hook-Dateien wurden durchsucht. Java-/Spring-Konfiguration, Templates, JS-Datenflüsse, Storage, Events, Tests und Deployment-Dokumentation wurden zusätzlich semantisch geprüft. `README.md` wurde ausdrücklich als UTF-16LE gelesen. `src.zip` wurde ohne Extraktion geöffnet: 133 Einträge, 72 Textdateien mit Branding-Fundstellen. Favicon-SVG und das 512-Pixel-PNG wurden geprüft. Die lokale, nicht versionierte `.vscode/launch.json` wurde ergänzend gelesen.

Build-Ausgaben, Abhängigkeiten und alte Testreports sind keine zu migrierenden Quellen. Ignorierte lokale Secrets, reale FTPS-Daten, Hosting-Einstellungen, DNS und GitHub-Secrets wurden nicht ausgelesen. Aussagen zur tatsächlich aktiven Infrastruktur sind daher ausdrücklich keine Live-Bestandsaufnahme.

Die abschließende Anforderung einer Markdown-Datei wird als ausdrückliche Ausnahme vom Schreibverbot verstanden: Nur diese neue Berichtsdatei wird geschrieben. Bestehende Projektdateien bleiben unverändert. Der Working Tree war zu Beginn sauber und enthält danach nur diesen unversionierten Bericht.

## Legende

- **LOW:** Text, Kommentar oder kosmetischer Name ohne externe Bindung.
- **MEDIUM:** Build-, Test- oder Konfigurationsvertrag; koordinierte Anpassung nötig.
- **HIGH:** Nutzerzustand, Live-Events, persistente Daten, Deployment oder öffentliche URL.
- **D — hard rename safe:** im genannten atomaren Änderungspaket direkt umbenennbar.
- **T — temporary compatibility required:** Übergangsphase mit alten und neuen Namen erforderlich.
- **L — long-term compatibility recommended:** alte Zugänge/Lesepfade länger erhalten.
- **N — do not rename:** neutral/fachlich/extern oder historisch unverändert belassen.

Pfade in Tabellen: `R` = `src/main/resources`, `J` = `src/main/java/com/example/estpoker`, `JS` = `R/static/js`, `T` als Pfadpräfix = `R/templates`. Zeilennummern beziehen sich auf den analysierten Commit; die letzte Tabellenspalte verwendet die Kompatibilitätskürzel.

## A. Visible branding

| Current value | File/location | Suggested target | Risk / compatibility |
|---|---|---|---|
| `RBS' Estimation Poker` | `R/messages.properties:3,7,203,205,296,297`; `messages_de.properties:3,7,209,211` | `RBS' Planning Poker`, About-Titel und Einleitung entsprechend | LOW / D |
| Alte Marketingtitel/-beschreibungen: `app.title`, `app.description`, `app.og.title` | Beide Message-Dateien:2–5 | Planning Poker; fachliche Schätzbegriffe erhalten | LOW / D; aktuell nicht die öffentlichen SEO-Head-Schlüssel |
| `RBS' Estimation Poker` als HTML-Fallback | `T/index.html:13`, `invite.html:14`, `room.html:13`, `about.html:19`, `fragments/head.html:12` | Neuer Produktname, mit bestehenden i18n-Keys synchron | LOW / D |
| `What is Estimation Poker?` / deutsche Entsprechung, Erklärung | Beide Bundles:192,194; `T/fragments/kbase.html:7,12` | „What is Planning Poker?“ und entsprechender Erklärungssatz | LOW / D |
| `Estimation Poker` als fachliches Synonym von Planning/Scrum Poker | `messages.properties:208,300`, `messages_de.properties:214`, `T/about.html:28` | Nicht mechanisch ersetzen: sonst „Planning Poker … or Planning Poker“; Synonym bewusst behalten oder redaktionell entfernen | LOW / Decision required |
| `og:site_name`, JSON-LD `name` | `T/fragments/head.html:25,38` | `RBS' Planning Poker` | LOW / D |
| `RBS Estimation Poker`, `Estimation Poker`, Manifest-Beschreibung | `R/static/manifest.json:2–4` | `RBS' Planning Poker`, `Planning Poker`, passende Beschreibung | LOW / D; installierte PWA-Namen können erst später aktualisiert werden |
| `Estimation Poker`, `EST Poker`, `EstPoker` in Dokumentation | README:1,3,19; `docs/INDEX.md`, beide USER-GUIDEs, API, ARCHITECTURE, BRIEFING, DEVELOPER-GUIDE, DEPLOYMENT | Produktname bzw. konsistenter technischer Kurzname `PlanningPoker` | LOW / D; Infrastrukturbeispiele erst nach Bestätigung ändern |
| CSS-/JS-Headerkommentare | `R/static/styles.css:2`, `styles - Kopie.css:2`, `JS/room.js:1` | Neuer Brand bei aktuellen Kommentaren | LOW / D |
| Favicon/Logo, Sprachflaggen, Dev-/Feder-Icons | `R/static/favicon*`, `apple-touch-icon.png`, Templates | Geprüftes Hauptlogo enthält keinen alten Schriftzug; neutrale Dateinamen/Icons behalten | LOW / N; weitere Rastervarianten bei späterem Asset-Audit visuell gegenprüfen |

Die englische Message-Datei enthält doppelte About-Keys. Bei späterer Bearbeitung alle Definitionen berücksichtigen; ein früher ersetzter Wert kann sonst vom späteren alten Wert überschrieben werden. Die duplizierten Keys wurden hier nicht bereinigt.

## B. Internal namespaces

| Current | Verwendungen | Proposed target | Risk / compatibility |
|---|---|---|---|
| `com.example.estpoker` | Sämtliche 46 Java-Produktionsdateien und 9 Java-Testdateien: Packages, Imports, Pfade; Logging-Konfiguration; Metadaten `sourceType` | `com.example.planningpoker` | MEDIUM / D, alle Packages einschließlich Application-Klasse zusammen verschieben, Spring-Scanning erhalten |
| `EstpokerApplication` | `J/EstpokerApplication.java:7,9` | `PlanningPokerApplication` und Dateiname | MEDIUM / D mit Package-Migration; impliziter Bean-Name ändert sich ebenfalls, keine explizite Referenz gefunden |
| Maven `com.example:estpoker:1.4.0-SNAPSHOT`, `<name>estpoker</name>` | `pom.xml:15–19` | `com.example:planningpoker:1.4.0-SNAPSHOT`; `Planning Poker App` | MEDIUM / D im Build; externe Artefakt-Nutzer vorher prüfen |
| `estpoker-1.4.0-SNAPSHOT.jar` | Aus Maven abgeleitet; Docs/Startbeispiele | `planningpoker-1.4.0-SNAPSHOT.jar` | MEDIUM / T für externe Startskripte; Docker kopiert `target/*.jar` auf neutrales `app.jar` |
| `spring.application.name=estpoker` | `R/application.properties:2` | `planningpoker` | MEDIUM / T für Logfilter/Dashboards, keine Session-/DB-Migration dadurch |
| `logging.level.com.example.estpoker.rooms.service` | `R/application.properties:45`; Docs allgemeiner Package-Logger | neuer Package-Pfad | MEDIUM / D zusammen mit Packages |
| `ep-noxvobiscum-guardrails` | `package.json:2`, `package-lock.json:2,7` | `pp-noxvobiscum-guardrails` | LOW / D, Lockfile synchron; `private:true` |
| `ep.e2e`, `ep.default-language`, `ep.default-sequence`, `ep.features.reveal.menu`, `ep.features.reveal.button`, `ep.features.autoReveal.enabled`, `ep.features.autoReveal.minVotes`, `ep.flags.allExperimentsOff` | `R/application-e2e.properties:6–17`, `META-INF/additional-spring-configuration-metadata.json:50–59` | gleiche Suffixe unter `pp.` | MEDIUM / Decision required: kein Runtime-Binder/Reader dieser `ep.*`-Properties im aktuellen Java-Code gefunden; nicht mit aktiven `features.*` verwechseln |
| `ep.buildTag` | `package.json:16,17`, JVM-Option `-Dep.buildTag=...` | `pp.buildTag` | LOW / D bei Beibehaltung; kein Runtime-Reader gefunden |
| `__epMenuVer`, `__epSpecialsBridgeVer`, `__epWs`, `__epVU`, `__epSeqBridgeBound`, `__epRowActionFallback`, `__epRowActionHotfixBound`, `__epSyncRowActions` | `JS/menu.js:4`, `specials-bridge.js:17–18`, `room.js:391,490–491,1894,2134–2135,2413–2414,2504,2532` | `__pp...` | MEDIUM / D mit Tests; für externe Debug-Snippets optional zeitweilige Aliase |
| `__epE2EEvents`, `__epE2E_langEv` | `tests/toggles.spec.ts`, `tests/types/globals.d.ts`; `__epWs/__epVU` in Testhelpers | `__pp...` | MEDIUM / D, Typdeklarationen und Producer/Consumer synchron |
| `app.storage`, `app.security.password`, `features`, Profile `prod/e2e/test/eclipse`, normale Bean-Namen | Spring-Konfiguration, `@Bean`-Methoden | Behalten | LOW / N; nicht brandspezifisch |
| DOM-IDs/-Klassen, `data-ui-style`, `data-theme`, `.card-grid`, `#planning-poker-heading` | Templates/CSS/Tests | Behalten | LOW / N; keine Brand-Abhängigkeit |

### Events: vollständige Producer-/Consumer-Zuordnung

Alle produktiven `ep:`-Events sind ein **HIGH**-Vertrag zwischen JS-Dateien/Fragmenten. Ziel ist jeweils dasselbe Suffix unter `pp:`. Producer und Consumer in einem Release atomar wechseln (**D** bei kohärenten Asset-Versionen); bei gemischten Assets ist eine begrenzte Bridge (**T**) nötig. Kein unkontrolliertes Dual-Dispatch: sonst doppelte Aktionen/WS-Nachrichten. DOM-Ziel (`document` oder `window`), Payload und Bubbling unverändert erhalten.

| Event | Producer | Consumer / Besonderheit |
|---|---|---|
| `ep:menu-open` | `JS/menu.js:111` | `JS/room.js:1613` |
| `ep:auto-reveal-toggle` | `menu.js:337`, `room.js:1655` | `room.js:1905`; Tests `toggles.spec.ts:47` |
| `ep:topic-toggle` | `menu.js:338`, `room.js:1659`; Tests `topic-overflow-hint:25`, `topic-visibility-toggle:22,30` | `room.js:1911`; Testlistener `toggles:53` |
| `ep:participation-toggle` | `menu.js:339`, `room.js:1640` | `room.js:1923`; Testlistener `toggles:59`; Payload `estimating` bleibt fachlich unverändert |
| `ep:specials-toggle` | `menu.js:343,482`, `room.js:1666` | `menu.js:439`, `room.js:1941`, `specials-bridge.js:237` |
| `ep:hard-mode-toggle` | `menu.js:347`, `room.js:1670` | `room.js:1965` |
| `ep:close-room` | `menu.js:350` | `room.js:1887` |
| `ep:sequence-change` | `menu.js:433`; Tests `utils/helpers.ts:573`, `infinity-visibility.spec.ts:15` | `room.js:1895` auf `document`, akzeptiert `id` und `sequenceId`. Infinity-Test dispatcht auf `window`: abweichendes Eventziel, nicht blind umbenennen |
| `ep:specials-set` | `specials-bridge.js:109,243` | `room.js:1954` |
| `ep:lang-changed` | `header-controls.js:133` auf `document` | `room.js:2323` |
| `est:lang-change` | `header-controls.js:132`, `menu.js:280` auf `window` | `menu.js:491`; Ziel z. B. `pp:lang-change`, getrennt vom Event mit Suffix `lang-changed` belassen |
| `ep:topic:set` | `T/fragments/menu.html:238`, `tests/utils/topic.ts:79` | Kein aktueller Anwendungs-Consumer gefunden. MEDIUM / Decision required: Legacy-Fallback, nicht als wirksamen Kanal dokumentieren |
| `ep:reveal` | `tests/specials-stats.spec.ts:129`, `tests/utils/helpers.ts:277` | Kein Anwendungs-Consumer gefunden. MEDIUM / Decision required: Testfallback |
| `ep:reset` | `tests/utils/helpers.ts:375` | Kein Anwendungs-Consumer gefunden. MEDIUM / Decision required: Testfallback |

`scripts/check-menu-toggle-events.js:97–117` prüft exakt die drei Toggle-Namen und deren Payloads. Mit Events migrieren. Neutrale WS-Kommandos wie `participation:`, `reveal`, `reset` und JSON-Feldnamen nicht umbenennen.

## C. Browser storage

| Old key / storage | Read locations | Write locations | Proposed new key | Migration / risk |
|---|---|---|---|---|
| `estpoker-theme` / local | `T/fragments/head.html:101`; `JS/menu.js:449`; `header-controls.js:18–19` | `menu.js:289`; `header-controls.js:23`; Tests | `planningpoker-theme` | HIGH / T: sonst Theme-Verlust; schon vor CSS-Laden migrieren |
| `ep-theme` / local | `menu.js:449` | `menu.js:290` | In `planningpoker-theme` konsolidieren, nicht automatisch zweiten neuen Alias erzeugen | HIGH / T: als Legacy-Fallback lesen; Zielnamen-Entscheidung |
| `theme`, `themeMode` / local | `header-controls.js:19` | `header-controls.js:23` | Neutral belassen bzw. Legacy-Lesepfade zur Theme-Konsolidierung | MEDIUM / T; kein Brand-Rename, mögliche widersprüchliche Altwerte |
| `ep-ui-style` / local | `head.html:107`, `menu.js:447` | `menu.js:305`; UI-/Geometry-Tests | `pp-ui-style` | HIGH / T: sonst Clean → Dev; Migration vor Rendern, gültige Werte prüfen |
| `ep-name` / local | `T/index.html:72` | `index.html:95` | `pp-name` | MEDIUM / T: Namensvorbelegung geht sonst verloren |
| `ep-room` / local | `T/index.html:73` | `index.html:96` | `pp-room` | MEDIUM / T: letzte Raumvorbelegung geht sonst verloren |
| `ep-cid` / session | `JS/room.js:139–141` | `room.js:145,505` | `pp-cid` | HIGH / T: identische CID übernehmen, bevor neue ID generiert oder WS geöffnet wird; sonst Reconnect-/Identitätsprobleme |
| `ep-flash` / session | `JS/index-flash.js:7–8` | `room.js:415`; Entfernung `index-flash.js:10` | `pp-flash` | MEDIUM / T: einmalige Kick-/Raum-geschlossen-Nachricht nicht verlieren oder doppelt zeigen |
| `ep-presence:<encoded-name>` / local | Kein Reader im aktuellen Repository gefunden | `room.js:1975–1976` | `pp-presence:<encoded-name>` nur bei weiterem Bedarf | LOW / Decision required: nicht als aktive Presence-Quelle voraussetzen; keine belegte notwendige Datenübernahme |
| `ep-pf-ok:<room>:<name>` / session | `room.js:2338,2341` | `room.js:2350,2367` | `pp-pf-ok:<room>:<name>` | HIGH / T: Preflight-Zustand erhalten, sonst erneute Namensprüfung/Umleitung möglich |
| `lang` / local | `menu.js:43–46`; `header-controls.js:27–29` | `menu.js:245,453`; `header-controls.js:127` | `lang` | LOW / N: neutral; bei Domainwechsel trotzdem neuer Origin |

**Empfohlener Kompatibilitätsvertrag:** gültiger neuer Wert hat Vorrang; andernfalls definierte Legacy-Reihenfolge lesen und kopieren. Theme-Konflikte explizit festlegen: `planningpoker-theme`, `estpoker-theme`, `ep-theme`, `theme`, `themeMode`. Alten Wert zunächst nicht löschen. Für Rollback Zeitraum und ggf. begrenztes Dual-Write vereinbaren; sonst sieht alte Software später nur den zuletzt vor Migration gespeicherten Zustand. Fehlende/gesperrte Storage-APIs und ungültige Werte weiter sicher behandeln. Session-Keys im selben Tab migrieren, dynamische Suffixe unverändert lassen.

**Cookies/Sessions:** keine selbst definierten Brand-Cookies gefunden. `LocaleConfig.java:28–32` verwendet `SessionLocaleResolver`; die normale Servlet-Session (üblicherweise `JSESSIONID`, kein eigener Name konfiguriert) ist neutral und bleibt. Kein eigener Service Worker, IndexedDB- oder CacheStorage-Code gefunden. Das Manifest ist kein Beleg für Offline-Caches.

**Domain-Grenze:** Eine Key-Migration auf derselben Origin überträgt keine Daten von `ep.rbsnet.at` nach `pp.rbsnet.at`. Redirects allein übertragen weder localStorage noch sessionStorage. Ein Domainwechsel braucht eine eigene Entscheidung über akzeptierten Einstellungsverlust oder einen geprüften, begrenzten Übergabemechanismus. Keine pauschale Übertragung von CID/Sessiondaten in öffentliche URLs.

## D. Environment variables

| Old | Proposed new | Locations | Risk / compatibility concern |
|---|---|---|---|
| `EP_BASE_URL` | `PP_BASE_URL` | `.github/workflows/e2e.yml:18,43–69`, `playwright.config.ts:21`, `tests/pw.e2e.config.ts:5`, `tests/utils/env.ts:3`, `package.json:12,18`, lokale `.vscode/launch.json:34`, Test-/Doku-Fundstellen im Anhang | MEDIUM / T: neuen Namen bevorzugen, alten zeitweilig akzeptieren; CI-Secret und Skip-Bedingungen zusammen ändern |
| `EP_ROOM_URL` | `PP_ROOM_URL` | Workflow:19,43–69; `auto-reveal`, `cards-reveal`, `lang-runtime`, `menu-smoke`, `participation-spectator`, `prod-autoreveal`, `prod-smoke` | MEDIUM / T: vollständige Raum-URL inklusive Query erhalten; sonst unbemerkt übersprungene Tests möglich |
| `EP_MENU_JS` | `PP_MENU_JS` | `scripts/check-menu-toggle-events.js:14,22` | MEDIUM / T für externe Hook-/Shell-Aufrufe |
| `EP_ROOM_JS` | `PP_ROOM_JS` | gleicher Guard:15,23 | MEDIUM / T |
| `EP_CHECK_LOG` | `PP_CHECK_LOG` | gleicher Guard:16,24,138 | LOW / T, betrifft Diagnoseausgaben |
| `LOGGING_LEVEL_COM_EXAMPLE_ESTPOKER` | `LOGGING_LEVEL_COM_EXAMPLE_PLANNINGPOKER` | `docs/DEPLOYMENT.md:605`; externer Wert möglich | MEDIUM / T: bei Package-Wechsel neue Logger konfigurieren; alte Variable steuert neues Package nicht automatisch |

Keine weiteren expliziten `ESTPOKER_*`/`EST_POKER_*`-ENV-Namen gefunden. `EP_*`-Keys sind keine Belege für reale Secret-Werte. Spring-Properties `ep.*` sind gesondert in B erfasst; mögliche extern gesetzte Relaxed-Binding-Varianten müssen im Hosting geprüft werden.

**Nicht umbenennen:** `DF_FTP_HOST/PORT/USER/PASS/BASE` (Provider-/Storagevertrag), `ROOM_BCRYPT_COST`, `ROOM_PW_PEPPER`, `PORT`, `SPRING_PROFILES_ACTIVE`, `BASE_URL`, `PWDEBUG`, `CI` sowie `JDBC_URL`, `DB_USER`, `DB_PASSWORD` in kommentierten Zukunftsbeispielen. Risiko LOW / N für den Namen; tatsächliche Zugangsdaten/Peppers sind HIGH und kein Bestandteil dieses Rebrandings.

## E. Database und persistente Daten

| Object/name | Current | Recommendation | Risk / reason |
|---|---|---|---|
| Aktive relationale DB / Schema / Tabellen | Im implementierten Runtime-Stack nicht gefunden. `application-prod.properties:1–6` bezeichnet FTPS-only und schließt JDBC/JPA aus; POM hat keine JPA-/JDBC-/H2-Treiberabhängigkeit | **do not rename**: keine DB-Migration erfinden | HIGH bei falscher Annahme; reale Umgebung manuell bestätigen |
| FTPS-Verzeichnis | `app.storage.ftps.base-dir=${DF_FTP_BASE:rooms}`, `application.properties:23` | **do not rename** für neutrales `rooms`; tatsächlichen Override prüfen | HIGH / L: ein Pfadwechsel kann vorhandene Räume unsichtbar machen |
| Persistierte Dateien | `FtpsRoomStore.java:137–142`: `{base}/{roomCode}.json` | **do not rename** | HIGH / N: fachlicher Schlüssel, kein Brand |
| JSON-Schema/Objektfelder | `StoredRoom`, `StoredParticipant`, `RoomCodec`: code/title/owner/participants/settings/stats/history/passwordHash usw. | **do not rename** | HIGH / N: kein packagebezogener Type-Discriminator/Default-Typing gefunden; Packagewechsel soll JSON unverändert lassen, mit Alt-Snapshots testen |
| H2-Testnamen | `jdbc:h2:mem:e2e` in `application-e2e.properties:20`, `jdbc:h2:mem:testdb` in `src/test/resources/application-test.properties:1` | **do not rename** | LOW / N: neutral; derzeit Konfigurationsreste ohne passenden DB-Treiber im POM |
| DB `estpoker` | Nur Zukunftsbeispiel `pg_dump ... estpoker`, `docs/DEPLOYMENT.md:715–720` | **optional rename** des Beispiels zu `planningpoker`, keine SQL-Aktion | LOW / D für Doku; HIGH falls extern tatsächlich vorhanden |
| PostgreSQL/Neon | Kommentierte Platzhalter in `koyeb.yaml:9–16` | **do not rename** von `<db>`/ENV; externe Nutzung klären | HIGH / manuell; kein Beleg einer produktiven PostgreSQL-DB |
| Backups | Doku-Beispiel `/backup/estpoker-<date>/`, DEPLOYMENT:703 | **optional rename** neuer Backup-Namen; bestehende Archive erhalten | HIGH / L bei realer Restore-Automation |

Kein gefundener DB-Kandidat ist als tatsächlich aktives **must rename** belegbar. Keine SQL-/Flyway-/Liquibase-Migrationen, JPA-Entities oder brandspezifischen Tabellen/Spalten in den versionierten Quellen gefunden. Live-Räume liegen zusätzlich in Prozessspeicher: Deployment/Neustart ist unabhängig vom Branding nicht gleichbedeutend mit Erhalt aller laufenden Sessions. Git-Tag ersetzt kein Datenbackup.

## F. URLs / domain

### Domain-independent rebrand — must change for brand

- Produktname, Java-/JS-Namespaces, npm-/Maven-Namen können bei unveränderter Domain migriert werden.
- `github.com/nox-vobiscum/estpoker` erst zusammen mit einem ausdrücklich beschlossenen Repository-Rename aktualisieren: README:33–34, DEVELOPER-GUIDE:64–65, DEPLOYMENT:82,121,282–283 und lokaler Git-Remote. **HIGH / L** für alte Klon-/Dokulinks; Redirect-Verhalten nach Rename verifizieren, nicht voraussetzen.
- `scripts/rooms-smoke.sh:5` verwendet `https://ep-api.noxvobiscum.at`, nicht `ep.rbsnet.at`. **HIGH / Decision required**: Eigentümer/Nutzung und ein möglicher neuer API-Hostname sind unbestätigt.

### Domain-change dependent — only change if domain changes

| Location | Bei beschlossenem Wechsel zu `pp.rbsnet.at` | Risk / compatibility |
|---|---|---|
| `T/fragments/head.html:6,22,30,41` | Canonicals, OG-URL indirekt, Social-Bilder, JSON-LD-URL gemeinsam aktualisieren | HIGH / L |
| `R/static/sitemap.xml:3–4`, `robots.txt:14` | Zwei öffentliche Seiten und Sitemap-Verweis umstellen | HIGH / L |
| `application.properties:14`, `application-prod.properties:13`, Metadaten:26 | Neue WebSocket-Origin zulassen; alte während Übergang beibehalten | HIGH / T |
| `.github/workflows/health-monitoring.yml:27` | Healthcheck-URL ändern und echte Fehler auswerten | HIGH / T |
| `tests/seo.spec.ts:3`, ENV-URL-Werte, Test-Kommentare | Neue Origin erst mit Domain-Cutover erwarten | MEDIUM / T |
| README, API, ARCHITECTURE, BRIEFING, DEPLOYMENT, USER-GUIDEs | Live-/WS-/Monitoring-/Cloudflare-Beispiele aktualisieren | LOW / L für alte veröffentlichte Links |

`room.js:184–190` baut `/gameSocket` aus `location.host` und Protokoll; keine harte Produktionsdomain. Einladung/Navigation überwiegend relative URLs bzw. aktuelle Origin. `/`, `/about`, `/room`, `/invite`, `/join`, `/api/rooms`, `/i18n`, `/gameSocket`, `/healthz` und Query-Parameter bleiben fachlich neutral. Kein App-seitiger Redirect von alter zu neuer Domain gefunden. HTTP-Redirect-Regeln nicht ungeprüft auf bestehende WebSocket-Verbindungen anwenden. Alte Raumlinks benötigen Pfad-/Query-erhaltende Weiterleitung und einen gesonderten Reconnect-Test.

## G. SEO

| Klasse | Befund / Vorgehen | Risk / compatibility |
|---|---|---|
| Brand change | `app.title.short`, UI-H1/Fallbacks, `og:site_name`, JSON-LD-Name, Manifest, About-Einleitung, KB-Überschrift | LOW / D |
| SEO wording change | `seo.home.title` lautet bereits `Free Planning Poker Online – Scrum Estimation Tool | RBS`; About-Title und About-H1 sowie Landing-H2 sind bereits Planning-Poker-orientiert | LOW / optional: nicht unnötig umschreiben; spätere bewusste Optimierung separat |
| Keep estimation | `Scrum Estimation Tool`, `Real-time Scrum estimation`, `Real-time estimation`, `Multiple estimation decks`, estimating user stories, estimates, estimator/estimating-Felder | LOW / N: fachliche Sprache und Suchbegriffe |
| Fachliches Synonym | About erläutert „Planning Poker (also known as Scrum Poker or Estimation Poker)“ | LOW / Decision required: legitimes Synonym, kein Produktname |
| Domainabhängiges SEO | Canonical, OG-/Twitter-Bild-URL, JSON-LD-URL, Sitemap/robots | HIGH / L; kein vorgezogener Wechsel auf eine noch nicht aktive Domain |
| Semantik/Indexierung | Room/private Invite `noindex,nofollow`; Home/About indexierbar; bestehende i18n-Attribute; Logo-Alttexte sind neutral | LOW / N: Mechanik erhalten, keine doppelten Meta-Tags |

Message-Keys müssen nicht umbenannt werden, nur ihre Brand-Werte. Alte `app.title/app.og.title/app.description` sind nicht die aktuell genutzten öffentlichen `seo.*`-Metadaten; trotzdem konsistent pflegen. RBS, Autorenname, `rbsnet.at`, `rolandseper.at`, externe Bibliotheken und `schema.org` bleiben unverändert.

## H. Tests

| Betroffene Tests/Guards | Anpassung | Risk / compatibility |
|---|---|---|
| Alle 9 Java-Testdateien unter `src/test/java/com/example/estpoker` | Package/Pfad/Imports synchron zur App; Testklassennamen selbst neutral | MEDIUM / D |
| `tests/ui-style.spec.ts`, `control-geometry.spec.ts` | Storage-Setup und Assertions auf neue Keys; Legacy-Fälle zusätzlich prüfen | HIGH / T |
| `tests/toggles.spec.ts`, `infinity-visibility.spec.ts`, `specials-stats.spec.ts`, `topic-overflow-hint.spec.ts`, `topic-visibility-toggle.spec.ts`, `utils/helpers.ts`, `utils/topic.ts`, `types/globals.d.ts` | Events/Globals koordinieren; fehlende Consumer und window/document-Abweichung getrennt klären | HIGH / D für atomaren Vertrag, T falls Bridge |
| ENV-Nutzer: `auto-reveal`, `cards-reveal`, `lang-runtime`, `menu-smoke`, `participation-spectator`, `prod-autoreveal`, `prod-smoke`, `utils/env.ts`, beide Playwright-Konfigurationen | PP-Variablen plus temporäre EP-Fallbacks; keine False-green-Skips | MEDIUM / T |
| `tests/seo.spec.ts` | Domain erst bei Cutover; Titel nur bei bewusster Änderung; neue Brand-Assertions für JSON-LD-Name/OG-Sitename/Manifest ergänzen | MEDIUM / D bzw. T für Domain |
| `scripts/check-menu-toggle-events.js` | Namen und Payloads mit Producer/Consumer migrieren | HIGH / D |
| `FtpsRoomStoreJsonTest`, `StoredRoomPersistenceServiceTest`, CRUD-/Password-Tests | Alte JSON-Snapshots mit neuen Packages laden; Feldnamen/Hash/Zeiten unverändert prüfen | HIGH / Kompatibilitätsnachweis |

Keine versionierten Bild-Snapshots mit umzubenennenden Brand-Dateinamen gefunden. Bestehende neutrale Selektoren nicht als Rebranding-Nebenarbeit ändern. Keine Tests ausgeführt: Sie würden Reports, Build-Dateien und teils Raum-/FTPS-Zustände schreiben.

Vor Freigabe zusätzlich: alter Browserzustand → neue Version → Reload → Rollback; CID unverändert; Namensvorbelegung, Preflight, Kick-Flash, DE/EN, Light/Dark/System und Dev/Clean; Abstimmen/Reveal/Reset/Host/Specials/Topic; jede Eventaktion genau einmal; Build mit neuen Maven-Koordinaten; Firefox/Chromium. Domainwechsel als separate Testmatrix.

## I. GitHub / CI / Dokumentation

| Item | Befund / Ziel | Risk / compatibility |
|---|---|---|
| Repository/Remote | Derzeit `nox-vobiscum/estpoker`; später ggf. `nox-vobiscum/planningpoker` | HIGH / L; GitHub-App/Koyeb-Verknüpfung, Rechte und alte Clone-URLs prüfen |
| Artifact | `.github/workflows/ci.yml:91` `estpoker-app` → `planningpoker-app`; Uploadpfad `target/*.jar` neutral | MEDIUM / T falls externe Downloader |
| BRIEFING-Integritätsguard | `.githooks/pre-commit:27` und CI:46 verlangen exakt `# RBS' Estimation Poker — BRIEFING` | MEDIUM / D: mit `docs/BRIEFING.md:1` atomar ändern, sonst blockiert der neue Titel Commit/CI |
| Workflow-/Job-Namen | `CI`, `E2E (Playwright)`, `Health Check Monitoring...`, `build` neutral | LOW / N; Required Checks nicht unnötig umbenennen |
| Secrets/Bedingungen | E2E-Workflow EP_BASE_URL/EP_ROOM_URL inkl. Skip-/Upload-Bedingungen | MEDIUM / T; PP-Secrets zuerst zusätzlich bereitstellen |
| Cache/Badge/Templates | Maven-Cache ohne expliziten Brand-Key; kein relevanter Brand-Badge oder Issue-Template gefunden; PR-Template/CODEOWNERS neutral | LOW / N |
| Aktuelle Doku | README, docs/INDEX, BRIEFING, API, ARCHITECTURE, DEVELOPER-GUIDE, DEPLOYMENT, beide USER-GUIDEs, E2E-TESTING | LOW / D für Brand, MEDIUM/HIGH für operative Beispiele |
| Historisches | `docs/BACKLOG.md:21`, Referenzen auf alte Commits, `src.zip`, `filetree.txt`; `BRIEFING-ad5aa84.md` ist leer | LOW / N oder Decision required: Geschichte nicht nachträglich verfälschen |
| Duplikat | `R/static/styles - Kopie.css:2` enthält Brand-Kommentar; keine Template-Referenz gefunden, liegt aber im auslieferbaren Static-Verzeichnis | LOW / Decision required: spätere Pflege/Entfernung ausdrücklich entscheiden |
| Lokale IDE | Ignorierte `.vscode/launch.json:7,14,34,44,52` | LOW / D für Labels, MEDIUM/T für ENV; kein Repository-Rename bewirkt lokale Anpassung |

Kommentare: aktuelle Produktreferenz → später umbenennen; historische/technische Beschreibung → einzeln bewerten; fachliche Begriffe und fremde APIs → unverändert. `README.md` benötigt encodingbewusste Bearbeitung; UTF-8-only Suchen liefern dort unvollständige Ergebnisse. `filetree.txt` ist eine statische Verzeichnisaufnahme, kein Beleg aktuell vorhandener Laufzeitdateien.

**Audit-Nebenbefund:** E2E-Workflow nutzt auf Push `continue-on-error`; grüner Gesamtlauf beweist nicht, dass alle Jobs erfolgreich sind. Healthcheck verwendet `curl ... || true`. Für spätere Migration tatsächliche Jobresultate und ausgelieferte Version prüfen. Keine Workflow-Korrektur in diesem Audit.

## J. Hosting / external infrastructure

Jeder folgende externe Punkt: **external infrastructure item – requires manual verification**. Keine externe Konfiguration wurde im Audit geändert oder als aktuell bestätigt ausgegeben.

| Item | Repository-Beleg / offene Prüfung | Risk / compatibility |
|---|---|---|
| Koyeb-Service | `koyeb.yaml:2` nennt `estpoker`; Sitzungsverlauf nennt `whispering-alana/estpoker`, keine Live-Verifikation hier | HIGH / T: Service-Rename/Neuanlage, Deploy-Branch, GitHub-App, Healthcheck, Domainbindung und Rollback koordinieren |
| Container/Image | Dockerfile neutraler `/app/app.jar`; Docs nennen `estpoker`, Registry/GHCR-Beispiele | MEDIUM / T: reale Registry/Tags und Consumer prüfen, nicht nur Doku umbenennen |
| FTPS/DomainFactory | `DF_FTP_BASE` kann von `rooms` abweichen; Konto, Remote-Basis, Rechte, Backups und tatsächliche JSON-Dateien extern | HIGH / L: neue Namen nie ohne Dateninventar und Restore-Test |
| Alternative Serverinstallation | Doku nennt `/opt/estpoker`, `estpoker.service`, User `estpoker`, `/var/log/estpoker` | HIGH / T: Beispiele, keine belegte aktive Installation; falls aktiv Startskripte/Rechte/Logs gemeinsam umstellen |
| Backup-Verzeichnisse/Jobs | Doku `/backup/estpoker-<date>`; keine entsprechende aktive Backup-Scriptdatei belegt | HIGH / L: historische Backups und Restore-Kommandos erhalten |
| DNS/TLS/Cloudflare | `ep.rbsnet.at`, mögliche neue `pp.rbsnet.at`, Proxy-/WebSocket-/Redirectregeln | HIGH / L: Domainwechsel optional und separat freizugeben |
| Weitere API-Domain | `ep-api.noxvobiscum.at` aus Smoke-Script | HIGH / Decision required: getrennte Infrastruktur nicht aus App-Domain ableiten |
| GitHub | tatsächliche Secrets, Environments, Branchschutz, Required Checks, Webhooks/GitHub-App | HIGH / T: Repo-Rename und Deployment-Verbindung verifizieren |
| Monitoring/Cron/SEO-Verwaltung | Workflow-Healthcheck vorhanden; zusätzliche Monitore, Search Console, Sitemapeinreichung und externe Bookmarks unbekannt | MEDIUM bis HIGH / L |
| PWA/Browser-Sessions | Installationen, Origin-gebundene Daten, geöffnete Räume und Session-Cookies | HIGH / T/L bei Domainwechsel; kein transparenter Umzug durch einfachen Redirect |

## Decision required

1. Bleibt `ep.rbsnet.at` zunächst bestehen? Empfehlung: ja, Code-/Brandmigration und Domainwechsel getrennt abnehmen.
2. Soll ein einheitlicher Theme-Key `planningpoker-theme` verwendet werden oder `pp-theme`? Beide Legacy-Keys nicht unkoordiniert zu zwei neuen Wahrheiten machen.
3. Wie lang bleiben Storage-/ENV-Fallbacks und eventuelle Rollback-Dual-Writes bestehen? Wann dürfen Legacy-Werte gelöscht werden?
4. Müssen externe Debug-Tools oder ältere Asset-Versionen `ep:`/`est:`/`__ep*` weiterhin verstehen?
5. `ep:topic:set`, `ep:reveal`, `ep:reset`, ungebundene `ep.*`-Properties und der abweichende Infinity-Test: behalten, reparieren oder später getrennt entfernen? Kein Funktionsfix im Rebranding verstecken.
6. Bleibt „Estimation Poker“ als fachliches About-Synonym erhalten? Empfehlung: möglich, aber eindeutig vom Produktnamen unterscheiden.
7. Gibt es tatsächlich eine zusätzliche DB, externe `/opt/estpoker`-Installation oder brandspezifische FTPS-Basis? Ohne Bestätigung keine Daten-/Pfadmigration.
8. Repository, npm-/Maven-Name, Koyeb-Service und mögliche Registry-Namen endgültig festlegen; `ep-api.noxvobiscum.at` separat klären.
9. Wie werden `src.zip`, historischer Backlog und statischer Dateibaum behandelt? Empfehlung: Historie kennzeichnen, nicht blind neu verpacken/überschreiben.

## Empfohlene Migrationsreihenfolge

1. **0 — Checkpoint und Dateninventar:** vorhandenen Git-Tag nutzen; vor späterem Deploy FTPS-Backup/Restorefähigkeit, Hosting-Konfiguration und Browser-Übergang festhalten. Git sichert keine Betriebsdaten.
2. **1 — Interner Code:** Java-Package, Main-Klasse, Maven/npm, Logging und Metadaten gemeinsam migrieren; neutrale Modelle, JSON-Felder, Routes und Bean-Namen bewahren. Java-Tests gleichzeitig anpassen, Build grün halten.
3. **2 — Events/Globals:** Producer, Consumer, Guards, Testhelpers und Typen atomar umstellen; Payloads/Eventziele nicht ändern. Assets gemeinsam versionieren; keine doppelten fachlichen Aktionen durch Bridges.
4. **3 — Storage-Kompatibilität:** vor neuem Frontend-Release Early-Head-Migration, Menüs/Header, Join-Vorbelegung, CID und Preflight synchron implementieren. Alte Daten nicht sofort löschen; Rollback testen.
5. **4 — Sichtbares Branding und domainunabhängiges SEO:** beide Bundles samt Duplikaten, HTML-Fallbacks, Manifest, OG-Sitename, JSON-LD-Name; fachliches estimation behalten. BRIEFING und seine zwei Guards gemeinsam ändern.
6. **5 — Tests/ENV:** PP-Secrets zusätzlich bereitstellen, neue Namen bevorzugen/EP-Fallbacks behalten; alle Abnahmetests lokal/staging ausführen. Diese Anpassungen laufen bereits begleitend zu 1–4, nicht erst nach kaputten Zwischenständen.
7. **6 — DB-/Infrastrukturnamen:** nur bestätigte reale Kandidaten behandeln. Derzeit keine begründete relationale DB-Migration; FTPS `rooms` und JSON-Schlüssel beibehalten. Alternative Installationen separat koordinieren.
8. **7 — Repository/GitHub:** wenn gewünscht Repo umbenennen, Remote/Doku/App-Verknüpfung/Schutzregeln/Artefaktconsumer prüfen. Historische Tags/Commits bewahren.
9. **8 — Hosting/Deployment:** Service-/Image-/Pfadänderungen nur mit verifiziertem Zugang; Release auf bisheriger Domain deployen; Koyeb-Status und tatsächlich ausgelieferte Brand-Version prüfen. In-Memory-Räume/WS-Unterbrechung einplanen.
10. **9 — Optionaler Domainwechsel:** neue Domain/TLS/Origin-Allowlist vorbereiten, Session-/Storage-Entscheidung umsetzen, alte HTTP-Links weiterleiten, WS-Übergang separat testen. Keine Annahme, dass neue Origin alte Browserdaten sieht.
11. **10 — SEO-Finalisierung:** erst beim Domain-Cutover Canonical/OG-/JSON-LD-URLs, robots/Sitemap, Tests, Monitore und Doku zusammen umstellen; Room-noindex unverändert verifizieren.
12. **11 — Legacy-Cleanup:** erst nach vereinbartem Zeitraum und erfolgreicher Rollback-/Nutzungsprüfung EP-ENV/Storage-Aliase und ggf. Bridges entfernen. Alte Domain-/Dokulinks langfristig berücksichtigen.

## Abschließende Empfehlung

### Safe to rename directly

Aktuelle sichtbare Brand-Texte, HTML-Fallbacks, Manifest-Namen, JSON-LD-Name/OG-Sitename und aktuelle Kommentare (**LOW**). Java/Main/Maven/npm/Tests/Metadaten als kohärentes Build-Paket (**MEDIUM**), ohne JSON-/WS-Schemaänderung.

### Requires compatibility migration

Theme/UI-Stil/Name/Raum, CID/Preflight/Flash, ENV-Secrets und Rollback-Verhalten (**MEDIUM/HIGH**, T). Eventnamen/Globals atomar; Kompatibilitätsbridge nur bei bestätigtem Mischbetrieb. `lang` und neutrale Theme-Aliase nicht mechanisch rebranden.

### Requires infrastructure coordination

GitHub-Repo-/App-Verknüpfung, Koyeb-Service, reale Images/Startpfade/Backupjobs, FTPS-Basis und jede Domain-/TLS-/DNS-/WS-Origin-Änderung (**HIGH**). Kein belegter Anlass für eine DB-Umbenennung.

### Optional / cosmetic

Lokaler Checkout-Verzeichnisname, IDE-Labels, neue Backup-Dateinamen und rein dokumentarische DB-/systemd-Beispiele (**LOW** für Dokumentation, **HIGH** bei tatsächlich produktiver Verwendung). `src.zip`/historische Namen bewusst entscheiden.

### Do not rename

Fachliche estimation-/estimating-Begriffe, `rooms/participants/votes/topics`, JSON-Felder, Raumcodes, CID-Werte, Protokoll-Payloads, neutrale Routes/IDs, `lang`, Standardcookies, Provider-ENV, RBS/Autorendaten und externe Bibliotheksnamen. Teilstrings wie `sleep`, `step`, `test:`, `e2e`, `sep`, `SPECIALS` sind keine Projektkürzel.

## Abschlusskontrolle

Kein Rebranding umgesetzt. Keine bestehende Datei umgeschrieben oder umbenannt. Kein Commit, Branch-Rename, Datenbankzugriff, Deployment oder Infrastrukturupdate. HEAD und aktiver Branch bleiben unverändert. Einzige beabsichtigte Working-Tree-Abweichung ist dieser ausdrücklich angeforderte Markdown-Bericht; „keine Dateien geschrieben“ wäre deshalb keine zutreffende Abschlussbehauptung.

## Anhang: systematische Fundstellen

Der folgende Index umfasst versionierte Textdateien mit Branding-/Namespace-Fundstellen einschließlich UTF-16-README. Er ist ein Navigationsindex, keine globale Ersetzungsliste; die semantischen Einstufungen oben haben Vorrang. Das Binärarchiv und die ignorierte IDE-Konfiguration sind separat oben erfasst.

| Datei | Zeilen |
|---|---|
| `.githooks/pre-commit` | 27 |
| `.github/workflows/ci.yml` | 46, 91 |
| `.github/workflows/e2e.yml` | 16, 18, 19, 43, 47, 51, 59, 67, 69 |
| `.github/workflows/health-monitoring.yml` | 27 |
| `README.md` | 1, 3, 6, 19, 33, 34, 45, 46, 52 |
| `docs/API.md` | 3, 182, 869 |
| `docs/ARCHITECTURE.md` | 3, 9, 15, 121, 145, 161, 170, 490, 534 |
| `docs/BACKLOG.md` | 21 |
| `docs/BRIEFING.md` | 1, 9, 12, 156, 160, 339, 344, 377, 378 |
| `docs/DEPLOYMENT.md` | 3, 26, 82, 104, 121, 153, 167, 194, 199, 208, 218, 223, 243, 276, 277, 282, 283, 296, 304, 310, 319, 324, 329, 336, 340, 345, 346, 347, 362, 363, 368, 373, 391, 395, 398, 486, 500, 543, 595, 598, 605, 665, 670, 703, 720, 742, 772, 791, 830 |
| `docs/DEVELOPER-GUIDE.md` | 3, 64, 65, 84, 110, 125, 186, 190, 259, 321, 327, 332, 337, 342, 347, 381, 382, 392, 440, 446, 451, 635, 683, 692, 712, 750, 752, 770, 772, 773 |
| `docs/E2E-TESTING.md` | 28, 30, 38, 43, 48, 98, 120, 129, 153, 156, 170, 171, 175, 194 |
| `docs/INDEX.md` | 1, 3, 370 |
| `docs/USER-GUIDE-EN.md` | 1, 3, 7, 9, 11, 27, 36, 59, 307, 395, 396, 397 |
| `docs/USER-GUIDE.md` | 1, 3, 7, 9, 11, 27, 36, 59, 307, 395, 396, 397 |
| `filetree.txt` | 1, 61, 123, 172, 192, 271, 331 |
| `koyeb.yaml` | 2 |
| `package-lock.json` | 2, 7 |
| `package.json` | 2, 12, 16, 17, 18 |
| `playwright.config.ts` | 21 |
| `pom.xml` | 16, 18, 19 |
| `scripts/check-menu-toggle-events.js` | 5, 6, 7, 14, 15, 16, 22, 23, 24, 97, 101, 105, 108, 109, 112, 113, 116, 117, 138 |
| `scripts/rooms-smoke.sh` | 5 |
| `src/main/java/com/example/estpoker/EstpokerApplication.java` | 1, 7, 9 |
| `src/main/java/com/example/estpoker/config/AppStorageProperties.java` | 1 |
| `src/main/java/com/example/estpoker/config/FeaturesConfig.java` | 1 |
| `src/main/java/com/example/estpoker/config/FeaturesProperties.java` | 1 |
| `src/main/java/com/example/estpoker/config/FtpsClientConfig.java` | 1 |
| `src/main/java/com/example/estpoker/config/LocaleConfig.java` | 1 |
| `src/main/java/com/example/estpoker/config/PasswordProperties.java` | 1 |
| `src/main/java/com/example/estpoker/config/PersistenceConfig.java` | 1, 3, 4 |
| `src/main/java/com/example/estpoker/config/StorageConfig.java` | 1, 3, 4 |
| `src/main/java/com/example/estpoker/config/WebSocketConfig.java` | 1, 3 |
| `src/main/java/com/example/estpoker/controller/GameController.java` | 1, 3, 4, 5 |
| `src/main/java/com/example/estpoker/controller/HealthController.java` | 1 |
| `src/main/java/com/example/estpoker/controller/HomeController.java` | 1 |
| `src/main/java/com/example/estpoker/controller/I18nController.java` | 1 |
| `src/main/java/com/example/estpoker/controller/LocaleController.java` | 1 |
| `src/main/java/com/example/estpoker/controller/RoomCheckController.java` | 1, 3 |
| `src/main/java/com/example/estpoker/controller/RoomNameCheckController.java` | 1, 3, 4 |
| `src/main/java/com/example/estpoker/controller/SequencesController.java` | 1, 3 |
| `src/main/java/com/example/estpoker/controller/SignalController.java` | 1, 3, 4 |
| `src/main/java/com/example/estpoker/handler/GameWebSocketHandler.java` | 1, 3, 4, 5 |
| `src/main/java/com/example/estpoker/model/CardSequences.java` | 1 |
| `src/main/java/com/example/estpoker/model/Participant.java` | 1 |
| `src/main/java/com/example/estpoker/model/Room.java` | 1 |
| `src/main/java/com/example/estpoker/persistence/NoOpPersistentRooms.java` | 1 |
| `src/main/java/com/example/estpoker/persistence/PersistentRooms.java` | 1 |
| `src/main/java/com/example/estpoker/rooms/codec/RoomCodec.java` | 1, 3, 4, 5, 6 |
| `src/main/java/com/example/estpoker/rooms/model/StoredParticipant.java` | 1 |
| `src/main/java/com/example/estpoker/rooms/model/StoredRoom.java` | 1 |
| `src/main/java/com/example/estpoker/rooms/repo/FtpsRoomStore.java` | 1, 3, 4 |
| `src/main/java/com/example/estpoker/rooms/repo/RoomStore.java` | 1, 3 |
| `src/main/java/com/example/estpoker/rooms/service/InMemoryRoomPersistenceService.java` | 1, 3, 4 |
| `src/main/java/com/example/estpoker/rooms/service/NoOpRoomPersistenceService.java` | 1, 3 |
| `src/main/java/com/example/estpoker/rooms/service/RoomPersistenceService.java` | 1, 3 |
| `src/main/java/com/example/estpoker/rooms/service/RoomSnapshotter.java` | 1, 3 |
| `src/main/java/com/example/estpoker/rooms/service/StoredRoomPersistenceService.java` | 1, 3, 4, 5, 6, 7 |
| `src/main/java/com/example/estpoker/rooms/web/NameAvailabilityController.java` | 1, 3, 4 |
| `src/main/java/com/example/estpoker/rooms/web/RoomsController.java` | 1, 3, 4, 5 |
| `src/main/java/com/example/estpoker/security/PasswordHasher.java` | 1 |
| `src/main/java/com/example/estpoker/service/GameService.java` | 1, 3, 4, 5, 6 |
| `src/main/java/com/example/estpoker/service/RoomManager.java` | 1, 3 |
| `src/main/java/com/example/estpoker/service/StorageDiagnosticsService.java` | 1, 3 |
| `src/main/java/com/example/estpoker/service/StorageProbeService.java` | 1, 3 |
| `src/main/java/com/example/estpoker/storage/FileStorage.java` | 1 |
| `src/main/java/com/example/estpoker/storage/FtpsFileStorage.java` | 1, 3 |
| `src/main/java/com/example/estpoker/web/SecurityProbeController.java` | 1, 3 |
| `src/main/java/com/example/estpoker/web/StorageController.java` | 1, 3, 4, 5 |
| `src/main/resources/META-INF/additional-spring-configuration-metadata.json` | 26, 27, 50, 51, 52, 54, 55, 56, 57, 59 |
| `src/main/resources/application-e2e.properties` | 6, 7, 8, 11, 12, 13, 14, 17 |
| `src/main/resources/application-prod.properties` | 13 |
| `src/main/resources/application.properties` | 2, 14, 45 |
| `src/main/resources/messages.properties` | 2, 3, 4, 5, 7, 192, 194, 203, 205, 208, 296, 297, 300 |
| `src/main/resources/messages_de.properties` | 2, 3, 4, 5, 7, 192, 194, 209, 211, 214 |
| `src/main/resources/static/js/header-controls.js` | 9, 18, 132, 133 |
| `src/main/resources/static/js/index-flash.js` | 7 |
| `src/main/resources/static/js/menu.js` | 4, 111, 280, 289, 290, 305, 337, 338, 339, 343, 347, 350, 433, 439, 447, 449, 482, 491, 497 |
| `src/main/resources/static/js/room.js` | 1, 139, 391, 415, 490, 491, 1613, 1640, 1655, 1659, 1666, 1670, 1887, 1894, 1895, 1905, 1911, 1923, 1941, 1954, 1965, 1975, 2134, 2135, 2323, 2338, 2413, 2414, 2504, 2532 |
| `src/main/resources/static/js/specials-bridge.js` | 9, 10, 17, 18, 109, 111, 237, 243 |
| `src/main/resources/static/manifest.json` | 2, 3, 4 |
| `src/main/resources/static/robots.txt` | 14 |
| `src/main/resources/static/sitemap.xml` | 3, 4 |
| `src/main/resources/static/styles - Kopie.css` | 2 |
| `src/main/resources/static/styles.css` | 2 |
| `src/main/resources/templates/about.html` | 19, 28 |
| `src/main/resources/templates/fragments/head.html` | 6, 12, 22, 25, 30, 38, 41, 101, 107 |
| `src/main/resources/templates/fragments/kbase.html` | 7, 12 |
| `src/main/resources/templates/fragments/menu.html` | 238 |
| `src/main/resources/templates/index.html` | 13, 72, 73, 95, 96 |
| `src/main/resources/templates/invite.html` | 14 |
| `src/main/resources/templates/room.html` | 13 |
| `src/test/java/com/example/estpoker/ApplicationSmokeTest.java` | 1, 3 |
| `src/test/java/com/example/estpoker/SeleniumIT.java` | 1 |
| `src/test/java/com/example/estpoker/controller/RoomNameCheckControllerTest.java` | 1, 3, 4, 5 |
| `src/test/java/com/example/estpoker/model/RoomTest.java` | 1 |
| `src/test/java/com/example/estpoker/rooms/repo/FtpsRoomStoreJsonTest.java` | 1, 3 |
| `src/test/java/com/example/estpoker/rooms/service/StoredRoomPersistenceServiceTest.java` | 1, 3, 4, 5, 6, 7 |
| `src/test/java/com/example/estpoker/rooms/web/RoomsControllerCrudTests.java` | 1, 3, 4, 5 |
| `src/test/java/com/example/estpoker/rooms/web/RoomsControllerPasswordTests.java` | 1, 3, 4 |
| `src/test/java/com/example/estpoker/service/GameServiceNameTests.java` | 1, 3, 4 |
| `tests/auto-reveal.spec.ts` | 5, 6, 10, 17 |
| `tests/cards-reveal.spec.ts` | 3, 4, 10, 17 |
| `tests/control-geometry.spec.ts` | 14, 15 |
| `tests/infinity-visibility.spec.ts` | 15 |
| `tests/lang-runtime.spec.ts` | 3, 6 |
| `tests/menu-smoke.spec.ts` | 5, 6, 11, 12, 13 |
| `tests/participation-spectator.spec.ts` | 8, 9, 13, 19 |
| `tests/prod-autoreveal.spec.ts` | 3, 9, 10, 12 |
| `tests/prod-smoke.spec.ts` | 2, 8, 9, 13, 14, 24 |
| `tests/pw.e2e.config.ts` | 5 |
| `tests/seo.spec.ts` | 3 |
| `tests/specials-stats.spec.ts` | 129 |
| `tests/toggles.spec.ts` | 46, 47, 48, 49, 53, 54, 55, 59, 60, 61, 85, 86, 95, 96, 104, 106 |
| `tests/topic-flow.spec.ts` | 7 |
| `tests/topic-overflow-hint.spec.ts` | 25 |
| `tests/topic-visibility-toggle.spec.ts` | 22, 30 |
| `tests/types/globals.d.ts` | 7, 13, 19, 20 |
| `tests/ui-style.spec.ts` | 10, 11, 55, 77, 105 |
| `tests/utils/env.ts` | 3 |
| `tests/utils/helpers.ts` | 277, 375, 573, 585, 588, 622 |
| `tests/utils/topic.ts` | 79 |
