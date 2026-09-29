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

# TARA-0121: Zwei eigene, an eine TARA-ID gebundene Kommandos fuer die
# beiden KRITISCHEN Statusuebergaenge "Todo -> PO Accepted" (Bearbeitungs-
# erlaubnis) und "Accepted -> PO Release" (fachliche/releasebezogene
# Abnahme). Diese sind bewusst NICHT Teil von KEYWORDS: die alten, losen
# Keywords ("akzeptiert", "OK", ...) duerfen diese beiden kritischen
# Uebergaenge NICHT mehr autorisieren (siehe extract_po_accepted_ids /
# extract_po_release_ids). "po\s+accepted"/"po\s+release" statt einer
# einzelnen Alternation, da re.escape() Leerzeichen nicht als Trennzeichen
# fuer beliebigen Whitespace behandelt.
_PO_ACCEPTED_ALTERNATION = r"po\s+accepted"
_PO_RELEASE_ALTERNATION = r"po\s+release"

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

def _build_patterns(keyword_alternation: str):
    """Baut die beiden Match-Patterns ("Keyword -> IDs" und "IDs ->
    Keyword") fuer eine gegebene Keyword-Alternation (TARA-0121: generalisiert
    aus dem urspruenglich fest verdrahteten KEYWORDS-Fall, damit dieselbe
    Bindungs-/Negations-/Zitat-Logik auch fuer die neuen "PO Accepted"/
    "PO Release"-Kommandos wiederverwendet werden kann)."""
    keyword_then_ids = re.compile(
        r"\b(?:" + keyword_alternation + r")\b" + _CONNECTOR + _ID_LIST_PATTERN,
        re.IGNORECASE,
    )
    ids_then_keyword = re.compile(
        _ID_LIST_PATTERN + _CONNECTOR + r"\b(?:" + keyword_alternation + r")\b",
        re.IGNORECASE,
    )
    return keyword_then_ids, ids_then_keyword


_KEYWORD_THEN_IDS, _IDS_THEN_KEYWORD = _build_patterns(_KEYWORD_ALTERNATION)
_PO_ACCEPTED_KEYWORD_THEN_IDS, _PO_ACCEPTED_IDS_THEN_KEYWORD = _build_patterns(
    _PO_ACCEPTED_ALTERNATION
)
_PO_RELEASE_KEYWORD_THEN_IDS, _PO_RELEASE_IDS_THEN_KEYWORD = _build_patterns(
    _PO_RELEASE_ALTERNATION
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
    """Prueft, ob vor der Keyword-Position (mit beliebig vielen
    Fuellwoertern dazwischen, aber ohne Kontrast-Konnektor-Grenze) ein
    Negationswort steht (TARA-0096, gehaertet gegen Review-Finding PR #194:
    mehrere Fuellwoerter duerfen die Negation nicht umgehen)."""
    preceding = clause[:keyword_start]
    # Nur ein expliziter Kontrast-Konnektor ("aber", "trotzdem", "jedoch",
    # "doch", "but", "however") beendet die Reichweite einer vorausgehenden
    # Negation - ein blosses Komma NICHT, da Kommata haeufig nur einen
    # Einschub abtrennen, ohne die Negation inhaltlich aufzuheben (Review-
    # Finding Runde 4: "Das ist nicht, wie besprochen, akzeptiert TARA-0109"
    # muss weiterhin als NICHT freigegeben gelten). Damit ein spaeterer,
    # semantisch unabhaengiger echter Freigabe-Befehl im selben Satz nicht
    # faelschlich durch eine fruehere, unabhaengige Negation unterdrueckt
    # wird, gilt weiterhin (Review-Finding Runde 3): "Der alte Vorschlag ist
    # nicht akzeptabel, aber jetzt akzeptiert TARA-0109" muss als Freigabe
    # erkannt werden - hier trennt der Kontrast-Konnektor "aber" die
    # Negation vom spaeteren Keyword.
    boundary_match = list(
        re.finditer(r"\b(?:aber|trotzdem|jedoch|doch|but|however)\b", preceding, re.IGNORECASE)
    )
    if boundary_match:
        preceding = preceding[boundary_match[-1].end():]
    # Beliebig viele Fuellwoerter (<=12 Zeichen, kein TARA-Treffer) zwischen
    # Negationswort und Keyword zulassen - ein fester Wortzaehler waere
    # durch simples Auffuellen mit weiteren Fuellwoertern umgehbar (Review-
    # Finding Runde 4). Die Reichweite bleibt durch die Satz-/Absatzgrenze
    # der umschliessenden Clause (`_split_into_clauses`) sowie die obige
    # Kontrast-Konnektor-Grenze beschraenkt.
    # Nach dem Negationswort selbst darf direkt anhaengende Interpunktion
    # (z.B. "nicht," bei einem Einschub) stehen, bevor der Zwischenraum
    # beginnt - sonst wird die Negation durch ein einfaches Komma direkt
    # danach faelschlich uebersehen (Review-Finding Runde 4).
    negation_pattern = re.compile(
        r"\b(?:" + "|".join(_NEGATION_WORDS) + r")\b[^\w\s]*\s+(?:(?!TARA-\d{4})\S{1,12}\s+)*$",
        re.IGNORECASE,
    )
    return bool(negation_pattern.search(preceding))


def _extract_ids_for_patterns(
    body: str,
    keyword_then_ids,
    ids_then_keyword,
    keyword_alternation: str,
) -> List[str]:
    """Generische Extraktion (TARA-0121): liefert die sortierte, eindeutige
    Liste aller TARA-IDs, die im uebergebenen Kommentar-Text durch ein an
    die gegebenen Patterns gebundenes Kommando (Keyword <-> TARA-ID(s) im
    selben Satz/Absatz, ausserhalb von Zitat/Code, ohne vorausgehende
    Negation) freigegeben wurden. Wird von `extract_approved_tara_ids`
    sowie den neuen `extract_po_accepted_ids`/`extract_po_release_ids`
    verwendet, damit alle drei Kommandos dieselbe gehaertete Bindungs-/
    Negations-/Zitat-Logik teilen."""
    cleaned = _strip_quotes_and_code(body)
    found: List[str] = []
    for clause in _split_into_clauses(cleaned):
        for pattern, keyword_is_first in (
            (keyword_then_ids, True),
            (ids_then_keyword, False),
        ):
            for match in pattern.finditer(clause):
                keyword_start = match.start() if keyword_is_first else match.end()
                # Bei "IDs -> Keyword" muss die Negationspruefung auf die
                # tatsaechliche Keyword-Position erfolgen, nicht auf den
                # Match-Anfang (der bei diesem Muster die ID-Liste ist).
                if not keyword_is_first:
                    kw_match = re.search(
                        r"\b(?:" + keyword_alternation + r")\b$",
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


def extract_approved_tara_ids(body: str) -> List[str]:
    """Liefert die sortierte, eindeutige Liste aller TARA-IDs, die im
    uebergebenen Kommentar-Text durch ein gebundenes Freigabe-Kommando
    (Keyword <-> TARA-ID(s) im selben Satz/Absatz, ausserhalb von Zitat/
    Code, ohne vorausgehende Negation) freigegeben wurden."""
    return _extract_ids_for_patterns(
        body, _KEYWORD_THEN_IDS, _IDS_THEN_KEYWORD, _KEYWORD_ALTERNATION
    )


def extract_po_accepted_ids(body: str) -> List[str]:
    """TARA-0121 (P-26): Liefert die TARA-IDs, fuer die im Kommentar ein an
    die ID gebundenes "PO Accepted"-Kommando steht (z.B. "PO Accepted
    TARA-0121" oder "TARA-0121 ist PO Accepted"). Die alten, losen
    Keywords aus KEYWORDS (z.B. "akzeptiert") loesen dies bewusst NICHT
    aus - dieser Uebergang (Todo -> PO Accepted) ist die Bearbeitungs-
    erlaubnis und darf nur durch das explizite neue Kommando autorisiert
    werden."""
    return _extract_ids_for_patterns(
        body,
        _PO_ACCEPTED_KEYWORD_THEN_IDS,
        _PO_ACCEPTED_IDS_THEN_KEYWORD,
        _PO_ACCEPTED_ALTERNATION,
    )


def extract_po_release_ids(body: str) -> List[str]:
    """TARA-0121 (P-27): Liefert die TARA-IDs, fuer die im Kommentar ein an
    die ID gebundenes "PO Release"-Kommando steht (z.B. "PO Release
    TARA-0121" oder "TARA-0121 PO Release"). Autorisiert den Uebergang
    Accepted -> PO Release -> Done (fachliche/releasebezogene Abnahme nach
    Merge) - ebenfalls NICHT durch die alten losen Keywords ausloesbar."""
    return _extract_ids_for_patterns(
        body,
        _PO_RELEASE_KEYWORD_THEN_IDS,
        _PO_RELEASE_IDS_THEN_KEYWORD,
        _PO_RELEASE_ALTERNATION,
    )


_MODE_EXTRACTORS = {
    "approval": extract_approved_tara_ids,
    "accepted": extract_po_accepted_ids,
    "release": extract_po_release_ids,
}


def main(argv: List[str] | None = None) -> int:
    import sys

    argv = argv if argv is not None else sys.argv[1:]
    mode = "approval"
    # TARA-0121: optionales "--mode {approval,accepted,release}" fuer die
    # neuen Wrapper-Skripte check_po_accepted_keyword.sh /
    # check_po_release_keyword.sh; ohne Flag bleibt das bisherige Verhalten
    # (Modus "approval") unveraendert (Rueckwaertskompatibilitaet TARA-0109).
    if "--mode" in argv:
        idx = argv.index("--mode")
        try:
            mode = argv[idx + 1]
        except IndexError:
            print("NO_MATCH")
            print("FAIL: --mode benoetigt einen Wert", file=sys.stderr)
            return 1
        del argv[idx : idx + 2]

    if len(argv) < 1:
        print("NO_MATCH")
        print("FAIL: Usage: po_approval_parser.py [--mode approval|accepted|release] <COMMENT_FILE>", file=sys.stderr)
        return 1

    extractor = _MODE_EXTRACTORS.get(mode)
    if extractor is None:
        print("NO_MATCH")
        print(f"FAIL: Unbekannter Modus '{mode}'", file=sys.stderr)
        return 1

    comment_file = argv[0]
    try:
        with open(comment_file, "r", encoding="utf-8") as f:
            body = f.read()
    except OSError as exc:
        print("NO_MATCH")
        print(f"FAIL: Kommentar-Datei konnte nicht gelesen werden: {exc}", file=sys.stderr)
        return 1

    ids = extractor(body)
    if not ids:
        print("NO_MATCH")
        return 1

    for tara_id in ids:
        print(tara_id)
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
