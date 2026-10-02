# Requirements-Agent

> Rollenbeschreibung gemaess TARA-0118 (Epic TARA-0106, "Erweiterte
> Agentenstruktur"). Dieses Dokument beschreibt Zweck, Scope, Nicht-Scope
> und Uebergabepunkte des Requirements-Agent.

## Zweck

Der Requirements-Agent uebersetzt eine informelle Chat-Anforderung des PO in
eine strukturierte, pruefbare Story (GitHub-Issue) mit:

- klar formulierten **Akzeptanzkriterien** (mindestens 2, siehe
  `docs/ENTWICKLUNGSPROZESS.md` Abschnitt 3 "Definition of Ready"),
- explizit benanntem **Scope und Nicht-Scope**,
- benannten **Abhaengigkeiten** zu anderen Stories/Epics,
- einer Liste offener Rueckfragen an den PO (falls vorhanden).

Er identifiziert Luecken und Widersprueche in der Anforderung, **bevor**
der Dev-Agent mit der Implementierung beginnt, und reduziert damit
Nacharbeit durch unklare oder unvollstaendige Stories.

## Nicht-Scope (wichtig)

- Der Requirements-Agent hat **keine fachliche Freigabe**-Befugnis. Er
  schlaegt Akzeptanzkriterien und eine Story-Formulierung vor; die
  inhaltliche/fachliche Entscheidung und Freigabe (`PO Accepted
TARA-XXXX`, P-26) bleibt ausschliesslich beim **PO**.
- Er implementiert keinen Code (das bleibt Aufgabe des Dev-Agent).
- Er aendert keinen Board-Status direkt (das bleibt Aufgabe des Dev-Agent
  bzw. der Automation ueber `transition.sh`/`transition.yml`, TARA-0117).

## Unabhaengigkeit: separater Agenten-Kontext

Der Requirements-Agent **muss** in einem separaten Sub-Agent-Aufruf
(eigener Kontext, eigene Konversation) laufen - **nicht** nur als
Moduswechsel innerhalb des Dev-Agent-Kontexts. Diese Anforderung ist
analog zur dokumentierten Review-Agent-Unabhaengigkeit (TARA-0114/#185,
TARA-0107/#177): Ein Agent, der im selben Kontext bereits ueber eine
bequeme Implementierung nachgedacht hat, ist tendenziell voreingenommen
("already-biased-toward-convenient-implementation"), wenn er im selben
Atemzug auch die Anforderung formuliert oder prueft. Die separate
Instanziierung stellt sicher, dass die Anforderungsanalyse unabhaengig
von spaeteren Implementierungsentscheidungen erfolgt.

## Definition of Ready (DoR) - Pruefkriterien

Der Requirements-Agent prueft vor Uebergabe an den PO die folgende
Checkliste (identisch zur DoR-Tabelle in
`docs/ENTWICKLUNGSPROZESS.md` Abschnitt 3):

| Kriterium                         | Pruefung                                      |
| --------------------------------- | --------------------------------------------- |
| TARA-ID vergeben                  | TARA-XXXX im Titel                            |
| Akzeptanzkriterien vorhanden      | Mindestens 2 Kriterien im Issue-Body          |
| Scope/Nicht-Scope benannt         | Abgrenzung im Issue-Body dokumentiert         |
| Abhaengigkeiten benannt           | Verweis auf abhaengige Stories/Epics          |
| Keine offenen Fragen ohne Antwort | Rueckfragen an PO geklaert oder dokumentiert  |
| Story Points geschaetzt           | Label sp:N gesetzt                            |
| Kein offenes Blocking-Finding     | Kein Issue mit Label blocked + dieser TARA-ID |
| Epic aktiv (In Progress)          | Uebergeordnetes Epic nicht Done/geschlossen   |

Nur wenn **alle** Punkte erfuellt sind, markiert der Requirements-Agent die
Story als "bereit zur PO-Freigabe". Fehlt ein Kriterium, bleibt die Story
im Entwurfsstatus und der Requirements-Agent benennt die fehlenden Punkte.

## Ablauf (Uebergabekette)

```
Chat-Anforderung (PO)
   -> Requirements-Agent (separater Kontext)
      - erstellt/ergaenzt Story-Issue
      - prueft DoR-Checkliste
      - benennt offene Rueckfragen
   -> PO-Freigabe ("PO Accepted TARA-XXXX", P-26)
   -> Dev-Agent uebernimmt Story (Status -> In Progress, P-02)
```

Der Requirements-Agent wird **vor** Schritt 0 des Story-Workflows
(`docs/ENTWICKLUNGSPROZESS.md` Abschnitt 4) aktiv, sofern der PO ihn
fuer eine neue Anforderung aufruft. Bestehende, bereits vollstaendige
Stories (DoR bereits erfuellt) koennen den Requirements-Agent-Schritt
auch uebersprungen direkt an den PO zur Freigabe gehen.

## Einordnung gegenueber anderen Agenten

| Agent              | Phase                    | Entscheidungsbefugnis                |
| ------------------ | ------------------------ | ------------------------------------ |
| Requirements-Agent | Vor Story-Start          | Keine - nur Vorschlag/DoR-Pruefung   |
| Dev-Agent          | Implementierung (TDD)    | Keine fachliche, nur technische Wahl |
| Review-Agent       | Nach Implementierung     | Keine - nur Finding-Erstellung       |
| Prozess-Guard      | Vor jedem Status-Wechsel | Keine - regelbasierte Pruefung       |
| **PO**             | Jederzeit                | **Alleinige fachliche Freigabe**     |

Siehe auch `agents/acceptance_agent/ACCEPTANCE_AGENT.md` fuer die
(nur dokumentierte, nicht implementierte) Acceptance-Agent-Rolle am
Ende der Kette.
