"""TARA-0109: Gebundenes Freigabe-Kommando statt loser Keywords (P-15).

Ersetzt die bisherige lose Schluesselwort-Erkennung aus TARA-0086/TARA-0096
(jedes eigenstaendige Vorkommen von z.B. "OK" oder "akzeptiert" im Kommentar,
unabhaengig davon, ob es sich inhaltlich ueberhaupt auf eine Freigabe
bezieht) durch ein an eine konkrete TARA-ID GEBUNDENES Kommando, z.B.:

    akzeptiert TARA-0109
    TARA-0109 ist nun akzeptiert

Nur wenn ein gueltiges Keyword UND eine TARA-ID im selben, nicht zitierten/
nicht Code-eingebetteten Textabschnitt in enger Nachbarschaft (kurze
Verbindungswoerter wie "ist"/"nun"/"fuer" erlaubt) auftauchen, gilt die
jeweilige TARA-ID als freigegeben. Damit entfaellt automatisch der
Beispiel-Fehlalarm aus der Story:

    "Der Test ist OK, aber die Story ist noch nicht freigegeben."

- "OK" ist zwar ein gueltiges Keyword, aber es steht keine TARA-ID in
  ausreichender Naehe -> kein Match, kein falscher Alarm.

Zusaetzlich (P-20/Zitat-Ausschluss):
- Zeilen, die (nach Trimmen von Leerzeichen) mit ">" beginnen (Markdown-
  Blockquote), werden ignoriert.
- Inhalte innerhalb von Code-Fences (```...```) werden ignoriert.

Die bereits bestehende Negations-Ausnahme aus TARA-0096 ("nicht ", "kein ",
"keine ", "not " unmittelbar vor dem Keyword) bleibt erhalten.
"""
from __future__ import annotations

import re
from typing import List

KEYWORDS = (
    "po-ok",
    "freigabe erteilt",
    "freigegeben",
    "akzeptiert",
    "accepted",
    "ok",
)

_KEYWORD_ALTERNATION = "|".join(re.escape(k) for k in KEYWORDS)

# Negativer Lookbehind auf feste Negationswoerter (TARA-0096), unmittelbar
# vor dem Keyword.
_NEGATION_LOOKBEHIND = "(?<!nicht )(?<!kein )(?<!keine )(?<!not )"

# Bis zu zwei kurze "Verbindungswoerter" (je max. 12 Zeichen, kein weiteres
# TARA-Vorkommen) zwischen Keyword und ID erlaubt, damit natuerliche
# Formulierungen wie "TARA-0109 ist nun akzeptiert" erkannt werden, ohne
# dass beliebig weit entfernte ID-Erwaehnungen im selben Kommentar
# faelschlich gebunden werden. Lazy-Quantifier + Lookahead-Ausschluss von
# "TARA-\d{4}" verhindern, dass eine ECHTE, eigenstaendige TARA-ID als
# Fuellwort verschluckt wird (z.B. bei "akzeptiert TARA-0108, akzeptiert
# TARA-0109" darf "TARA-0108" nicht Fuellwort fuer die Bindung an
# "TARA-0109" werden).
_CONNECTOR = r"(?:\s+(?!TARA-\d{4})\S{1,12}){0,2}?\s+"

_ID_PATTERN = r"TARA-\d{4}"

_KEYWORD_THEN_ID = re.compile(
    _NEGATION_LOOKBEHIND
    + r"\b(?:"
    + _KEYWORD_ALTERNATION
    + r")\b"
    + _CONNECTOR
    + r"(?P<id>"
    + _ID_PATTERN
    + r")",
    re.IGNORECASE,
)

_ID_THEN_KEYWORD = re.compile(
    r"(?P<id>"
    + _ID_PATTERN
    + r")"
    + _CONNECTOR
    + _NEGATION_LOOKBEHIND
    + r"\b(?:"
    + _KEYWORD_ALTERNATION
    + r")\b",
    re.IGNORECASE,
)

_CODE_FENCE_PATTERN = re.compile(r"```.*?```", re.DOTALL)


def _strip_quotes_and_code(body: str) -> str:
    """Entfernt Code-Fence-Bloecke vollstaendig und ersetzt Blockquote-Zeilen
    (beginnend mit optionalem Leerraum + '>') durch Leerzeilen, damit
    Zeilennummern/Restinhalt fuer Debugging erhalten bleiben, zitierte
    Kommandos aber nicht mehr matchen koennen."""
    without_code = _CODE_FENCE_PATTERN.sub("", body or "")
    lines = without_code.splitlines()
    active_lines = ["" if line.strip().startswith(">") else line for line in lines]
    return "\n".join(active_lines)


def extract_approved_tara_ids(body: str) -> List[str]:
    """Liefert die sortierte, eindeutige Liste aller TARA-IDs, die im
    uebergebenen Kommentar-Text durch ein gebundenes Freigabe-Kommando
    (Keyword <-> TARA-ID in enger Nachbarschaft, ausserhalb von Zitat/Code)
    freigegeben wurden."""
    cleaned = _strip_quotes_and_code(body)
    found: List[str] = []
    for pattern in (_KEYWORD_THEN_ID, _ID_THEN_KEYWORD):
        for match in pattern.finditer(cleaned):
            tara_id = match.group("id").upper()
            if tara_id not in found:
                found.append(tara_id)
    return sorted(found)


def main(argv: List[str] | None = None) -> int:
    import sys

    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) < 1:
        print("NO_MATCH")
        print("FAIL: Usage: po_approval_parser.py <COMMENT_FILE>", file=sys.stderr)
        return 1

    comment_file = argv[0]
    try:
        with open(comment_file, "r", encoding="utf-8") as f:
            body = f.read()
    except OSError as exc:
        print("NO_MATCH")
        print(f"FAIL: Kommentar-Datei konnte nicht gelesen werden: {exc}", file=sys.stderr)
        return 1

    ids = extract_approved_tara_ids(body)
    if not ids:
        print("NO_MATCH")
        return 1

    for tara_id in ids:
        print(tara_id)
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
