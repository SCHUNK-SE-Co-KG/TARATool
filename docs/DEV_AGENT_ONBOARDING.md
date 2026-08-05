# Dev Agent Onboarding

Dieses Dokument beschreibt die Einrichtung der Entwicklungsumgebung für das TARATool-Projekt.

## Voraussetzungen

Folgende Tools müssen lokal installiert und erreichbar sein:

- **git** ≥ 2.40 — Versionskontrolle
- **gh** (GitHub CLI) ≥ 2.40 — PR/Issue-Management und Board-Automation
- **node** / npm ≥ 20 — Frontend-Tooling
- **python** ≥ 3.11 — Test-Runner, Skripte, Review-Agent

## Initiale Einrichtung

### 1. Repository klonen

```bash
git clone https://github.com/Bheowulf/TARATool.git
cd TARATool
```

### 2. Python-Abhängigkeiten installieren

```bash
python -m venv tests/.venv
tests/.venv/Scripts/activate   # Windows
source tests/.venv/bin/activate # macOS / linux
pip install -r tests/requirements.txt
```

### 3. Node-Abhängigkeiten installieren

```bash
npm install
```

### 4. GitHub CLI authentifizieren

```bash
gh auth login
```

Anschließend Projektzugriff prüfen:

```bash
gh project list --owner Bheowulf
```

### 5. GitHub Project-IDs konfigurieren

Die Projekt-IDs sind in `scripts/set_story_status.py` hinterlegt:
- **Bheowulf** Project: `PVT_kwHOBLN4284BfLtb`
- **SCHUNK** Project: `PVT_kwDOBu4dv84BfbaR`

## Smoke-Test

Prüft ob die Basisumgebung korrekt eingerichtet ist:

```bash
cd tests
.venv/Scripts/python.exe -m pytest test_TARA_0004.py --noconftest -v
```

Alle Tests in `test_TARA_0004.py` sollten grün sein.

## Entwicklungsprozess

Siehe `agents/process_guard/PROCESS_GUARD_AGENT.md` (P-01 – P-17) für den vollständigen Prozess.

Kurzzusammenfassung:

1. Feature-Branch von `development`: `git checkout -b feature/TARA-XXXX`
2. Tests schreiben (TDD), dann Implementation
3. Review Agent ausführen, alle Findings beheben
4. PR auf `development` erstellen
5. Nach Review-OK → Merge in `development`
6. Status auf **Freigabe** setzen
7. PO-Freigabe: Kommentar `PO-OK` im Issue → Status → **Done**

## Board-Status setzen

```bash
python scripts/set_story_status.py XXXX "InProgress"
python scripts/set_story_status.py XXXX "Freigabe"
```
