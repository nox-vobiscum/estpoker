Projekt: RBS Estimation Poker (Spring + Thymeleaf + Vanilla JS).
Ziel: Stabilisierung des App-Menüs (Theme, Language, Card-Sequence, Auto-Reveal, Ticket/Story, Participation) und i18n.
Regeln:

Ein File pro Turn, vollständiger IST-Stand wird vorher angefragt.

Keine Annahmen über Pfade/Existenz/Versionen; erst IST erfragen.

Keine Inline-Styles, Styles nur in styles.css.

Nur CardSequences.java ist Quelle der Karten; Sonderkarten (❓💬☕) werden im Frontend separat angehängt.

Step-by-step: Ich bestätige jeden Schritt, bevor der nächste kommt.

Aktuelle Verträge (Menu → Room):

ep:auto-reveal-toggle {on:boolean}
ep:topic-toggle {on:boolean}
ep:participation-toggle {estimating:boolean}
ep:sequence-change {id:string}
ep:close-room {}

WS-Befehle (Room → Server): autoReveal:…, topicVisible:…, participation:…, sequence:…, revealCards, resetRoom, closeRoom, vote:…, topicSave:…, topicClear.

Startaufgabe (P0): Prüfe menu.js und room.js auf korrekte Event-Dispatch/Event-Listener-Kopplung für die drei Toggles und liefere exakt ein File mit fix + Logs (Dev only).
