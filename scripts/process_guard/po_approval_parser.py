"""TARA-0109: Gebundenes Freigabe-Kommando statt loser Keywords (P-15).

Ersetzt die bisherige lose Schluesselwort-Erkennung aus TARA-0086/TARA-0096
(jedes eigenstaendige Vorkommen von z.B. "OK" oder "akzeptiert" im Kommentar,
unabhaengig davon, ob es sich inhaltlich ueberhaupt auf eine Freigabe
bezieht) durch ein an eine konkrete TARA-ID GEBUNDENES Kommando, z.B.:

    akzeptiert TARA-0109
    TARA-0109 ist nun akzeptiert
    TARA-0108 und TARA-0109 akzeptiert

Nur wenn ein gueltiges Keyword UND (eine oder mehrere, per ","/"und"/"/"
verbundene) TARA-ID(s) IM SELBEN SATZ/ABSATZ, ausserhalb von Zitat/Code, in
enger Nachbarschaft (kurze Verbindungswoerter wie "ist"/"nun"/"fuer" erlaubt)
auftauchen, gelten die jeweiligen TARA-IDs als freigegeben. Damit entfaellt
automatisch der Beispiel-Fehlalarm aus der Story:

    "Der Test ist OK, aber die Story ist noch nicht freigegeben."

- "OK" ist zwar ein gueltiges Keyword, aber es steht keine TARA-ID in
  ausreichender Naehe -> kein Match, kein falscher Alarm.

Zusaetzlich (P-20/Zitat-Ausschluss):
- Zeilen, die (nach Trimmen von Leerzeichen) mit ">" beginnen (Markdown-
  Blockquote), werden ignoriert.
- Inhalte innerhalb von Code-Fences (```...```) werden ignoriert.
- Mit >=4 Leerzeichen eingerueckte Zeilen (GFM-Codebloecke) werden ignoriert.

Die bereits bestehende Negations-Ausnahme aus TARA-0096 ("nicht ", "kein ",
"keine ", "not " vor dem Keyword, auch mit einem Fuellwort dazwischen)
bleibt erhalten.

Haertung nach Review-Finding PR #194 (TARA-0109):
- Keyword<->ID-Bindung wird auf denselben Satz/Absatz begrenzt (Trennung an
  ".", "!", "?" und Leerzeilen), damit ein Keyword nicht mehr faelschlich an
  eine ID in einem voellig anderen Satz gebunden wird (z.B. "Sieht ok aus.
  TARA-0109 bitte nochmal pruefen." darf NICHT als Freigabe von TARA-0109
  gelten).
- Die Negationspruefung erfasst nun auch ein Fuellwort zwischen Negations-
  wort und Keyword ("nicht wirklich akzeptiert TARA-0109" wird abgelehnt).
- Eine ID-Liste ("TARA-0108 und TARA-0109 akzeptiert") wird vollstaendig
  gebunden, nicht nur die naechstgelegene ID.
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

_NEGATION_WORDS = ("nicht", "kein", "keine", "not")

# Bis zu zwei kurze "Verbindungswoerter" (je max. 12 Zeichen, kein weiteres
# TARA-Vorkommen) zwischen Keyword und ID erlaubt, damit natuerliche
# Formulierungen wie "TARA-0109 ist nun akzeptiert" erkannt werden. Lazy-
# Quantifier + Lookahead-Ausschluss von "TARA-\d{4}" verhindern, dass eine
# ECHTE, eigenstaendige TARA-ID als Fuellwort verschluckt wird. Whitespace
# innerhalb des Connectors darf keine Leerzeile (Absatzgrenze) sein - das
# wird zusaetzlich durch die Satz-/Absatz-Segmentierung in
# `_split_into_clauses` sichergestellt, bevor ueberhaupt gematcht wird.
_CONNECTOR = r"(?:[ \t]+(?!TARA-\d{4})\S{1,12}){0,2}?[ \t]+"

_ID_PATTERN = r"TARA-\d{4}"

# Liste mehrerer durch ","/"und"/"/" verbundener TARA-IDs (z.B.
# "TARA-0108 und TARA-0109" oder "TARA-0108, TARA-0109").
_ID_LIST_PATTERN = (
    r"(?P<ids>"
    + _ID_PATTERN
    + r"(?:\s*(?:,|/|und)\s*"
    + _ID_PATTERN
    + r")*)"
)

_KEYWORD_THEN_IDS = re.compile(
    r"\b(?:"
    + _KEYWORD_ALTERNATION
    + r")\b"
    + _CONNECTOR
    + _ID_LIST_PATTERN,
    re.IGNORECASE,
)

_IDS_THEN_KEYWORD = re.compile(
    _ID_LIST_PATTERN
    + _CONNECTOR
    + r"\b(?:"
    + _KEYWORD_ALTERNATION
    + r")\b",
    re.IGNORECASE,
)

_CODE_FENCE_PATTERN = re.compile(r"```.*?```", re.DOTALL)


def _strip_quotes_and_code(body: str) -> str:
    """Entfernt Code-Fence-Bloecke vollstaendig und ersetzt Blockquote-Zeilen
    (beginnend mit optionalem Leerraum + '>') sowie mit >=4 Leerzeichen
    eingerueckte Zeilen (GFM-Codebloecke) durch Leerzeilen, damit
    Zeilennummern/Restinhalt fuer Debugging erhalten bleiben, zitierte/
    Code-eingebettete Kommandos aber nicht mehr matchen koennen."""
    without_code = _CODE_FENCE_PATTERN.sub("", body or "")
    lines = without_code.splitlines()
    active_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(">") or line.startswith("    ") or line.startswith("\t"):
            active_lines.append("")
        else:
            active_lines.append(line)
    return "\n".join(active_lines)


def _split_into_clauses(text: str) -> List[str]:
    """Zerlegt den Text in Saetze/Abschnitte (Trennung an '.', '!', '?' sowie
    Leerzeilen), damit eine Keyword<->ID-Bindung nicht ueber Satz- oder
    Absatzgrenzen hinweg erfolgen kann (Review-Finding PR #194)."""
    # Zuerst an Leerzeilen (Absaetzen) trennen, dann jeden Absatz zusaetzlich
    # an Satzzeichen. \s*\n\s*\n\s* deckt beliebig viele Leerzeilen ab.
    paragraphs = re.split(r"\n\s*\n+", text)
    clauses: List[str] = []
    for paragraph in paragraphs:
        clauses.extend(re.split(r"(?<=[.!?])\s+|[.!?]+", paragraph))
    return clauses


def _has_unfilled_negation(clause: str, keyword_start: int) -> bool:
    """Prueft, ob unmittelbar vor der Keyword-Position (mit max. einem
    Fuellwort dazwischen) ein Negationswort steht (TARA-0096, gehaertet
    gegen Review-Finding PR #194: ein zusaetzliches Fuellwort darf die
    Negation nicht mehr umgehen)."""
    preceding = clause[:keyword_start]
    # Bis zu ein Fuellwort (<=12 Zeichen, kein TARA-Treffer) zwischen
    # Negationswort und Keyword zulassen.
    # Beliebig viele (nicht nur ein einzelnes) Fuellwoerter zwischen
    # Negationswort und Keyword zulassen - begrenzt durch die Satzgrenze der
    # umschliessenden Clause (siehe `_split_into_clauses`), daher unproblema-
    # tisch bzgl. Backtracking/False Positives ueber weite Distanzen hinweg.
    negation_pattern = re.compile(
        r"\b(?:" + "|".join(_NEGATION_WORDS) + r")\s+(?:(?!TARA-\d{4})\S{1,12}\s+)*$",
        re.IGNORECASE,
    )
    return bool(negation_pattern.search(preceding))


def extract_approved_tara_ids(body: str) -> List[str]:
    """Liefert die sortierte, eindeutige Liste aller TARA-IDs, die im
    uebergebenen Kommentar-Text durch ein gebundenes Freigabe-Kommando
    (Keyword <-> TARA-ID(s) im selben Satz/Absatz, ausserhalb von Zitat/
    Code, ohne vorausgehende Negation) freigegeben wurden."""
    cleaned = _strip_quotes_and_code(body)
    found: List[str] = []
    for clause in _split_into_clauses(cleaned):
        for pattern, keyword_is_first in (
            (_KEYWORD_THEN_IDS, True),
            (_IDS_THEN_KEYWORD, False),
        ):
            for match in pattern.finditer(clause):
                keyword_start = match.start() if keyword_is_first else match.end()
                # Bei "IDs -> Keyword" muss die Negationspruefung auf die
                # tatsaechliche Keyword-Position erfolgen, nicht auf den
                # Match-Anfang (der bei diesem Muster die ID-Liste ist).
                if not keyword_is_first:
                    kw_match = re.search(
                        r"\b(?:" + _KEYWORD_ALTERNATION + r")\b$",
                        match.group(0),
                        re.IGNORECASE,
                    )
                    keyword_start = match.start() + kw_match.start() if kw_match else match.end()
                if _has_unfilled_negation(clause, keyword_start):
                    continue
                for tara_id in re.findall(_ID_PATTERN, match.group("ids"), re.IGNORECASE):
                    tara_id = tara_id.upper()
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
