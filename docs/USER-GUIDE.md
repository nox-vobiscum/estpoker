# Benutzerhandbuch – EstPoker

Einfache Anleitung zur Nutzung des EstPoker Estimation Tools für agile Teams.

---

## Was ist EstPoker?

EstPoker ist ein Online-Tool für **Planning Poker** Sessions in agilen Teams. Damit können Teams gemeinsam User Stories oder Aufgaben schätzen, ohne dass persönliche Vorurteile die Schätzung beeinflussen.

**Live-App:** https://ep.rbsnet.at/

### Vorteile

✅ Keine Registrierung erforderlich  
✅ Sofort einsatzbereit per Link  
✅ Echtzeit-Synchronisation  
✅ Funktioniert auf Desktop, Tablet und Smartphone  
✅ Keine Installation nötig (läuft im Browser)  

---

## Schnellstart

### 1. Raum erstellen (als Moderator/Host)

1. Öffne https://ep.rbsnet.at/
2. Gib einen **Raumnamen** ein (z.B. "Sprint-Planning-2024")
3. Gib deinen **Namen** ein (z.B. "Maria")
4. Klicke auf **"Raum erstellen"**

**→ Du bist jetzt im Raum und automatisch Moderator!**

### 2. Team einladen

1. Kopiere den **Link** oben in der Leiste (z.B. `https://ep.rbsnet.at/room?roomCode=...`)
2. Teile den Link mit deinem Team (Slack, Teams, E-Mail, etc.)
3. Teammitglieder öffnen den Link und geben ihren Namen ein

**→ Alle Teilnehmer sehen sich gegenseitig in Echtzeit!**

### 3. Schätzen

1. **Moderator** gibt das Thema vor (z.B. "USER-123: Login-Funktion")
2. Alle Teilnehmer wählen eine **Karte** (Zahl oder Symbol)
3. Sobald alle abgestimmt haben, klickt der Moderator auf **"Aufdecken"**
4. Das Ergebnis wird mit Durchschnitt und Median angezeigt

**→ Team diskutiert Unterschiede und schätzt ggf. erneut!**

---

## Die Benutzeroberfläche

### Übersicht der Hauptbereiche

```
┌─────────────────────────────────────────────────┐
│  [EstPoker]  👤 Dein Name    [⋮ Menü]  [🔗]    │  ← Kopfzeile
├─────────────────────────────────────────────────┤
│  📋 Thema: USER-123: Login implementieren       │  ← Aktuelles Thema
├─────────────────────────────────────────────────┤
│                                                 │
│   [1] [2] [3] [5] [8] [13] [21]                │  ← Karten zum Wählen
│   [☕] [❓]                                      │
│                                                 │
├─────────────────────────────────────────────────┤
│  👥 Teilnehmer:                                 │
│   • Maria (Moderator) ✓ [5]                    │  ← Teilnehmerliste
│   • Tom ✓ [8]                                   │
│   • Sarah ✓ [?]                                 │
├─────────────────────────────────────────────────┤
│  [Aufdecken]  (nur für Moderator)              │  ← Aktions-Buttons
└─────────────────────────────────────────────────┘
```

---

## Die Karten

### Standard-Karten (Fibonacci)

Die Standard-Kartenwerte folgen der Fibonacci-Sequenz, die sich bewährt hat für Story Points:

| Karte | Bedeutung |
|-------|-----------|
| **1** | Sehr klein / trivial (1-2 Stunden) |
| **2** | Klein (halber Tag) |
| **3** | Klein bis mittel |
| **5** | Mittel (1-2 Tage) |
| **8** | Groß (3-5 Tage) |
| **13** | Sehr groß (1 Woche) |
| **21** | Extra groß (zu groß, aufteilen!) |

### Spezial-Karten

| Karte | Bedeutung | Verwendung |
|-------|-----------|------------|
| **❓** | Fragezeichen | "Ich verstehe die Aufgabe nicht" / Diskussionsbedarf |
| **☕** | Kaffeepause | "Ich brauche eine Pause" |
| **🔭** | Teleskop | "Braucht mehr Analyse" (optional) |
| **⏳** | Sanduhr | "Warten auf etwas" (optional) |

**Hinweis:** Spezial-Karten werden **nicht** in den Durchschnitt einberechnet.

---

## Funktionen Schritt für Schritt

### Als Teilnehmer abstimmen

1. **Warte**, bis der Moderator ein Thema angibt
2. **Überlege** dir deine Schätzung (z.B. "Das ist eine 5")
3. **Klicke** auf die entsprechende Karte
4. **Deine Wahl** wird markiert (grün umrandet)
5. Bei anderen Teilnehmern siehst du ein ✓ (aber nicht ihre Karte!)
6. **Warte** auf das Aufdecken

**Tipp:** Du kannst deine Wahl jederzeit ändern, bevor aufgedeckt wird!

### Als Moderator arbeiten

#### Thema eingeben

1. **Klicke** auf das Thema-Feld oben
2. **Gib** den Titel ein (z.B. "USER-123: Login")
3. Oder füge einen **JIRA-Link** ein – der Issue-Key wird automatisch extrahiert!
4. **Drücke Enter** oder klicke außerhalb

**→ Alle sehen sofort das neue Thema!**

#### Karten aufdecken

1. **Warte**, bis alle abgestimmt haben (✓ bei allen Teilnehmern)
2. **Klicke** auf **"Aufdecken"**
3. **Siehst** die Ergebnisse:
   - Gewählte Karte bei jedem Teilnehmer
   - **Durchschnitt** (arithmetisches Mittel)
   - **Median** (mittlerer Wert)
   - **Spanne** (niedrigster bis höchster Wert)
   - **Ausreißer** (Werte, die stark abweichen)

#### Runde zurücksetzen

1. **Nach der Diskussion** klicke auf **"Zurücksetzen"**
2. **Alle Stimmen** werden gelöscht
3. **Nächste Runde** kann beginnen

### Einstellungen anpassen (Menü)

Klicke auf **[⋮ Menü]** rechts oben, um Einstellungen zu öffnen:

#### 📊 Kartensatz wechseln

Verschiedene Sequenzen für unterschiedliche Schätz-Methoden:

- **Fibonacci** (Standard): 1, 2, 3, 5, 8, 13, 21
- **Fibonacci erweitert**: 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ∞
- **T-Shirt-Größen**: XS, S, M, L, XL, XXL
- **Zweierpotenzen**: 1, 2, 4, 8, 16, 32, 64

**Wann wechseln?**
- **T-Shirt-Größen** → Grobe, schnelle Schätzungen
- **Fibonacci erweitert** → Wenn sehr große oder sehr kleine Aufgaben dabei sind
- **Zweierpotenzen** → Technische Aufgaben (oft bei DevOps)

#### ⚡ Auto-Aufdecken

**Aktiviert:** Karten werden automatisch aufgedeckt, sobald alle abgestimmt haben  
**Deaktiviert:** Moderator muss manuell auf "Aufdecken" klicken

**Empfehlung:** Aktivieren für schnelle Sessions, deaktivieren wenn Zeit für Diskussion vor dem Aufdecken gewünscht ist.

#### ☕ Spezial-Karten

**Aktiviert:** Zeigt zusätzliche Karten (☕, 🔭, ⏳, etc.)  
**Deaktiviert:** Nur Zahlen und Fragezeichen

#### 📋 Thema anzeigen

**Aktiviert:** Thema ist für alle sichtbar  
**Deaktiviert:** Thema ist ausgeblendet (aber gespeichert)

#### 👓 Zuschauer-Modus

Als Teilnehmer kannst du zwischen **Teilnehmer** und **Zuschauer** wechseln:

- **Teilnehmer:** Deine Stimme zählt
- **Zuschauer:** Du siehst alles, aber deine Stimme zählt nicht (z.B. für Stakeholder, die nur zuschauen)

---

## Häufige Fragen (FAQ)

### Wie viele Personen können teilnehmen?

Theoretisch unbegrenzt, aber **5-10 Personen** sind ideal für Planning Poker.

### Was passiert, wenn jemand die Verbindung verliert?

- **Kurze Unterbrechung** (<5 Sekunden): Automatische Wiederverbindung
- **Längere Unterbrechung**: Teilnehmer wird als "getrennt" markiert (grau hinterlegt)
- **Rückkehr**: Einfach Seite neu laden – der gewählte Name wird wiedererkannt

### Was passiert mit dem Moderator, wenn er die Verbindung verliert?

Ein anderer Teilnehmer wird **automatisch zum neuen Moderator** ernannt. Wenn der ursprüngliche Moderator zurückkehrt, kann er die Rolle wieder übernehmen.

### Werden die Daten gespeichert?

**Standardmäßig:** Nein. Alles läuft im Arbeitsspeicher des Servers und geht verloren, wenn alle den Raum verlassen.

**Optional:** Der Server kann so konfiguriert werden, dass Räume als Snapshots gespeichert werden (für spätere Wiederaufnahme).

### Kann jemand die Stimmen anderer vor dem Aufdecken sehen?

**Nein!** Das ist der Kern von Planning Poker: Niemand sieht die Stimmen der anderen, bis der Moderator aufdeckt. So wird vermieden, dass frühe Schätzungen die späteren beeinflussen.

### Wie lange bleibt ein Raum aktiv?

Ein Raum bleibt aktiv, solange mindestens eine Person verbunden ist. Wenn alle den Raum verlassen, wird er nach kurzer Zeit automatisch geschlossen (ohne Persistenz).

### Kann ich einen bestehenden Raum wiederfinden?

Nur über den **Link**! Es gibt keine Raumliste. Speichere den Link, wenn du später zurückkehren möchtest.

### Funktioniert es auf dem Smartphone?

Ja! Die Oberfläche passt sich automatisch an kleine Bildschirme an. Am besten im Querformat nutzen für mehr Übersicht.

---

## Tipps für effektive Sessions

### 🎯 Vorbereitung

- **Thema im Voraus vorbereiten**: Liste der User Stories/Tasks bereithalten
- **Alle Beteiligten einladen**: Sicherstellen, dass alle den Link haben
- **Definition of Done klären**: Team sollte wissen, was "fertig" bedeutet

### 💡 Während der Session

- **Zeitbox pro Story**: Max. 5 Minuten pro Schätzung
- **Bei großen Unterschieden**: Personen mit höchster/niedrigster Schätzung erklären lassen
- **Zweite Runde**: Wenn nötig, nach Diskussion erneut abstimmen
- **Pausen einplanen**: Nach 45-60 Minuten kurze Pause

### ⚖️ Umgang mit Ausreißern

Wenn jemand **sehr viel höher** oder **niedriger** schätzt als der Rest:

1. **Fragen**, warum diese Person so schätzt
2. **Zuhören** – oft gibt es wichtige Aspekte, die andere übersehen haben
3. **Diskutieren** – Team-Verständnis angleichen
4. **Erneut abstimmen** – mit neuem Wissen

### 🚫 Häufige Fehler vermeiden

- **Zu lange diskutieren**: Bei 3-5 Minuten ohne Konsens → Story aufteilen oder später besprechen
- **Erste Person beeinflusst**: Darum **erst aufdecken**, wenn alle gewählt haben
- **Zu technisch werden**: Focus auf "Wie viel Arbeit?" statt "Wie machen wir es?"
- **Perfektionismus**: Planning Poker ist eine grobe Schätzung, kein exakter Wert!

---

## Tastatur-Shortcuts (für Power-User)

| Taste | Funktion |
|-------|----------|
| **1-9** | Karte mit entsprechender Zahl wählen |
| **?** | Fragezeichen-Karte wählen |
| **Leertaste** | Menü öffnen/schließen |
| **R** | Runde zurücksetzen (nur Moderator) |
| **V** | Aufdecken (nur Moderator) |
| **Esc** | Menü schließen |

---

## Troubleshooting

### Problem: Ich kann keine Karte wählen

**Lösung:**
- Prüfe, ob du als **Zuschauer** markiert bist (im Menü umschalten)
- Stelle sicher, dass du mit dem Internet verbunden bist
- Lade die Seite neu (F5)

### Problem: Ich sehe keine anderen Teilnehmer

**Lösung:**
- Prüfe, ob du im richtigen Raum bist (Link prüfen)
- Lade die Seite neu (F5)
- Stelle sicher, dass andere tatsächlich beigetreten sind

### Problem: Mein Name ist doppelt vergeben

**Lösung:**
- Der Server fügt automatisch eine Nummer hinzu (z.B. "Maria" → "Maria-2")
- Oder: Einen eindeutigen Namen beim Beitreten wählen

### Problem: Die Seite lädt nicht

**Lösung:**
- Prüfe deine Internetverbindung
- Leere den Browser-Cache (Strg+Shift+R / Cmd+Shift+R)
- Versuche einen anderen Browser
- Prüfe, ob die App online ist: https://ep.rbsnet.at/

### Problem: WebSocket-Verbindung schlägt fehl

**Lösung:**
- Prüfe, ob dein Unternehmen WebSockets blockiert (Firewall/Proxy)
- Versuche es im privaten/Inkognito-Modus
- Kontaktiere deinen IT-Support

---

## Beispiel-Session

### Szenario: Sprint Planning für 5 User Stories

**Teilnehmer:**
- Maria (Scrum Master, Moderator)
- Tom (Developer)
- Sarah (Developer)
- Alex (QA)
- Chris (Product Owner, Zuschauer)

**Ablauf:**

1. **10:00** – Maria erstellt Raum "Sprint24-Planning"
2. **10:02** – Alle Teammitglieder sind beigetreten
3. **10:05** – Chris wechselt zu Zuschauer-Modus (will nicht mitschätzen)
4. **10:05** – Maria gibt erstes Thema ein: "USER-123: Login-Funktion"
5. **10:07** – Alle haben abgestimmt:
   - Maria: 5
   - Tom: 8
   - Sarah: 5
   - Alex: 8
6. **10:08** – Aufgedeckt: Durchschnitt 6.5, Median 6.5
7. **10:09** – Diskussion: Tom und Alex erklären ihre 8 (Testing-Aufwand)
8. **10:12** – Zweite Abstimmung: Alle wählen 8 → **Konsens!**
9. **10:12** – Maria setzt zurück
10. **10:13** – Nächstes Thema: "USER-124: Passwort vergessen"
11. ... (weitere Stories)
12. **11:00** – Session beendet, Ergebnisse in JIRA eingetragen

**Ergebnis:** 5 Stories geschätzt in 60 Minuten

---

## Für Team-Leads: Einführung im Team

### Vorbereitung

1. **Demo-Session** mit 2-3 Kollegen vorab durchführen
2. **Regeln festlegen**: Wie gehen wir mit Ausreißern um? Wann zweite Runde?
3. **Kartenwerte definieren**: Was bedeutet bei uns eine "5"? (z.B. 2 Tage Arbeit)
4. **Link vorbereiten**: Raum im Voraus erstellen, Link in Einladung

### Erste Session

1. **5 Min**: Tool kurz vorstellen und demonstrieren
2. **5 Min**: Eine einfache Story als Übung schätzen
3. **40 Min**: Echte Stories schätzen
4. **10 Min**: Retrospektive: Was lief gut? Was können wir verbessern?

### Best Practices etablieren

- **Feste Zeit**: Z.B. jeden Dienstag 10:00-11:00
- **Vorbereitung**: Product Owner bereitet Stories vor
- **Timeboxing**: Max. 5 Minuten pro Story
- **Fokus**: Nur schätzen, nicht designen

---

## Glossar

| Begriff | Erklärung |
|---------|-----------|
| **Planning Poker** | Schätz-Methode für agile Teams, bei der alle gleichzeitig abstimmen |
| **Story Points** | Relative Maßeinheit für Aufwand (keine Zeitangabe!) |
| **Moderator/Host** | Person, die die Session leitet (kann Thema setzen, aufdecken, etc.) |
| **Zuschauer** | Teilnehmer, der nur zuschaut, aber nicht abstimmt |
| **Durchschnitt** | Arithmetisches Mittel aller Stimmen |
| **Median** | Mittlerer Wert (halbiert die Stimmen in zwei Hälften) |
| **Ausreißer** | Stimmen, die stark vom Durchschnitt abweichen |
| **Konsens** | Alle haben die gleiche Karte gewählt |
| **Fibonacci-Sequenz** | 1, 2, 3, 5, 8, 13, 21... (jede Zahl ist die Summe der beiden vorherigen) |

---

## Kontakt & Support

**Live-App:** https://ep.rbsnet.at/  
**GitHub:** https://github.com/nox-vobiscum/estpoker  
**Dokumentation:** https://github.com/nox-vobiscum/estpoker/tree/main/docs

**Bei Problemen:**
1. Prüfe diese Anleitung und [Troubleshooting](#troubleshooting)
2. Erstelle ein Issue auf GitHub
3. Kontaktiere deinen Team-Lead oder IT-Support

---

*Letzte Aktualisierung: 2026-07-22*
