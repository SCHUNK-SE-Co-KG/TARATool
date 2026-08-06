# GitHub Copilot - TARATool Dev-Agent Instructions

> Diese Datei wird von GitHub Copilot CLI automatisch in jeder Session als Systeminstruktion eingelesen.
> Sie beschreibt den Session-Start-Ablauf und verweist auf die massgeblichen Prozessdokumente.
> Inhalte werden **nicht** hier dupliziert - stets die referenzierten Dateien lesen.

---

## Projekt-Kontext

| | |
|-|-|
| **Lokales Verzeichnis** | Clone des `development`-Branches |
| **Primaeres Repo** | https://github.com/Bheowulf/TARATool |
| **Mirror-Repo (SCHUNK)** | https://github.com/SCHUNK-SE-Co-KG/TARATool |
| **Projektboard (Primary)** | https://github.com/users/Bheowulf/projects/1 (ID: `PVT_kwHOBLN4284BfLtb`) |
| **Projektboard (Mirror)** | https://github.com/orgs/SCHUNK-SE-Co-KG/projects/4 |
| **Aktiver Branch** | `development` |

Commits erfolgen auf `Bheowulf/TARATool`. Der Mirror wird automatisch synchronisiert.
Board-Status wird ausschliesslich ueber das **Bheowulf-Board #1** gelesen und geschrieben.

---

## Massgebliche Dokumentation

| Dokument | Pfad | Inhalt |
|----------|------|--------|
| **Entwicklungsprozess** | `docs/ENTWICKLUNGSPROZESS.md` | Vollstaendiger Prozess, Rollen, Workflow, Regeln P-01-P-17 |
| **Board-IDs & GraphQL** | `docs/GITHUB_BOARD.md` | API-IDs, Status-Optionen, gh-Befehle |
| **Dev-Agent Einrichtung** | `agents/dev_agent/DEV_AGENT_ONBOARDING.md` | Setup, Smoke-Test, Kurzreferenz |
| **Prozess-Guard-Regeln** | `agents/process_guard/PROCESS_GUARD_AGENT.md` | P-01-P-17 vollstaendig, Finding-Format |
| **Review-Agent** | `agents/review_agent/REVIEW_AGENT_WORKFLOW.md` | R-01-R-30, Severity, Finding-Framework |
| **Mirror-Sync** | `docs/MIRROR_SYNC_GUIDE.md` | Board-Sync Bheowulf <-> SCHUNK |

> **Beim Session-Start diese Dateien lesen**, bevor mit der Arbeit begonnen wird.

---

## Wer ist der Product Owner?

Der PO ist der GitHub-User mit **Schreibrechten auf beide Repos** (`Bheowulf/TARATool`
und `SCHUNK-SE-Co-KG/TARATool`). Der aktive Chat-Gespraechspartner ist der PO.

---

## WICHTIGSTE REGEL: Keine Arbeit ohne PO-Freigabe

**Keine Implementierung, kein Branch, keine Tests - ohne nachgewiesene Freigabe.**

Freigabe ist gegeben wenn eine der folgenden Bedingungen erfuellt ist:
1. Chat-Nachricht in der aktuellen Session enthaelt: `freigegeben`, `Freigabe fuer TARA-XXXX`, `PO-OK`
2. GitHub Issue-Kommentar am Epic oder Story enthaelt: `PO-OK`, `Freigabe erteilt`, `freigegeben`

---

## Session-Start: Pflichtablauf (vor jeder Implementierung)

### 1 - Board laden: In Progress
- Alle **In-Progress**-Items aus Board #1 laden
- Offene `review-finding`- oder `blocked`-Issues pruefen
- Zusammenfassung ausgeben

### 2 - Board laden: Todo - Epics
- Alle **Epic**-Issues (Label `epic`) mit Status **Todo** laden
- Issue-Kommentare auf Freigabe-Muster pruefen
- Freigegebene Epics identifizieren

### 3 - Stories des freigegebenen Epics pruefen
- Alle zugehoerigen Stories laden und Freigabe pruefen
- **Alle Stories freigegeben** -> autonom mit naechster Story (Abhaengigkeitsreihenfolge) beginnen
- **Teilweise freigegeben** -> freigegebene bearbeiten, PO auf fehlende Freigaben hinweisen
- **Keine Story freigegeben** -> PO informieren und warten

### 4 - Zusammenfassung ausgeben
- Was wird bearbeitet? Was fehlt? Was ist blockiert?

---

## Regel P-01 (immer aktiv)

Waehrend der Arbeit an einer Story: TARA-ID in **jeder** Chat-Antwort nennen.
Beispiel: `[TARA-0026]`

---

> Vollstaendige Prozessregeln (P-01-P-17): `agents/process_guard/PROCESS_GUARD_AGENT.md`
> Vollstaendiger Story-Workflow: `docs/ENTWICKLUNGSPROZESS.md` (Abschnitt 4)
