"""Tests fuer TARA-0086: Audit-Trail per Pflicht-Kommentar bei Board-Status-
Wechsel + vollstaendige Erkennung der PO-Freigabe-Schluesselwoerter.

Prueft:
- scripts/process_guard/check_po_approval_keyword.sh erkennt alle in
  copilot-instructions.md dokumentierten Schluesselwoerter (PO-OK,
  Freigabe erteilt, freigegeben, akzeptiert, Accepted, Ok) case-insensitiv
  als eigenstaendiges Wort/Phrase (keine False-Positives bei Woertern wie
  'Token' oder 'broken', die die Buchstabenfolge 'ok' zufaellig enthalten).
- po-approve.yml ruft dieses Skript auf statt einer starren contains()-Liste.
- copilot-instructions.md dokumentiert exakt dieselben Schluesselwoerter wie
  das Skript tatsaechlich erkennt (Accepted, Ok ergaenzt).

TARA-0109-Anpassung: Seit TARA-0109 genuegt ein Keyword allein NICHT mehr -
es muss an eine konkrete TARA-ID GEBUNDEN sein (siehe test_TARA_0109.py fuer
die vollstaendige Spezifikation des Bindungsverhaltens). Die folgenden Tests
wurden entsprechend um eine gebundene TARA-ID ergaenzt bzw. um Faelle
erweitert, die ein Keyword OHNE gebundene ID erwartungsgemaess ablehnen.
"""
import os
import re
import subprocess
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(REPO_ROOT, "scripts", "process_guard", "check_po_approval_keyword.sh")
PARSER_MODULE = os.path.join(REPO_ROOT, "scripts", "process_guard", "po_approval_parser.py")
WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "po-approve.yml")
# TARA-0120: Die vollstaendige Freigabe-Keyword-Liste wurde aus
# copilot-instructions.md in die operative Instructions-Datei ausgelagert.
INSTRUCTIONS = os.path.join(REPO_ROOT, ".github", "instructions", "workflows.instructions.md")


def _to_bash_path(path):
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_check(comment_text):
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as f:
        f.write(comment_text)
        comment_file = f.name
    try:
        return subprocess.run(
            ["bash", _to_bash_path(SCRIPT), _to_bash_path(comment_file)],
            capture_output=True,
            text=True,
            timeout=30,
        )
    finally:
        os.remove(comment_file)


@pytest.mark.TARA_0086
@pytest.mark.parametrize(
    "comment",
    [
        "PO-OK TARA-0086",
        "po-ok TARA-0086 bitte umsetzen",
        "Freigabe erteilt fuer TARA-0086",
        "freigabe erteilt TARA-0086",
        "freigegeben TARA-0086, danke",
        "TARA-0086 ist akzeptiert",
        "TARA-0086 Accepted, thanks!",
        "TARA-0086 Ok",
        "OK TARA-0086 passt",
        "ok TARA-0086, mach das",
    ],
)
def test_recognizes_valid_po_approval_keywords(comment):
    result = _run_check(comment)
    assert result.returncode == 0, f"'{comment}' haette erkannt werden muessen: {result.stdout}{result.stderr}"
    assert "TARA-0086" in result.stdout


@pytest.mark.TARA_0086
@pytest.mark.parametrize(
    "comment",
    [
        "Sieht gut aus, bitte noch einmal pruefen",
        "Das ist leider broken",
        "Neues Access Token wurde erstellt",
        "Bitte den Stock pruefen",
        "",
    ],
)
def test_rejects_comments_without_po_approval_keyword(comment):
    result = _run_check(comment)
    assert result.returncode == 1, f"'{comment}' haette NICHT erkannt werden duerfen: {result.stdout}{result.stderr}"
    assert "NO_MATCH" in result.stdout


@pytest.mark.TARA_0109
@pytest.mark.parametrize(
    "comment",
    [
        "PO-OK",
        "Freigabe erteilt",
        "freigegeben, danke",
        "Ich habe es akzeptiert",
        "Accepted, thanks!",
        "Ok",
        "OK passt",
    ],
)
def test_rejects_keyword_without_bound_tara_id(comment):
    """TARA-0109: Ein Keyword OHNE gebundene TARA-ID genuegt seit TARA-0109
    NICHT mehr als Freigabe (Kernaenderung dieser Story)."""
    result = _run_check(comment)
    assert result.returncode == 1, f"'{comment}' haette OHNE gebundene TARA-ID NICHT erkannt werden duerfen: {result.stdout}"
    assert "NO_MATCH" in result.stdout


@pytest.mark.TARA_0096
@pytest.mark.parametrize(
    "comment",
    [
        "Bitte NICHT ok TARA-0086 geben",
        "das ist NICHT OK TARA-0086 fuer mich",
        "Nicht ok TARA-0086, bitte nochmal",
        "kein OK TARA-0086",
        "keine ok TARA-0086",
        "not ok TARA-0086",
    ],
)
def test_rejects_negated_approval_phrases(comment):
    """TARA-0096: Eine explizite Ablehnung (Negation unmittelbar vor dem
    Freigabe-Keyword) darf NICHT als gueltige Freigabe gewertet werden -
    auch nicht, wenn eine TARA-ID in der Naehe steht (TARA-0109)."""
    result = _run_check(comment)
    assert result.returncode == 1, f"'{comment}' haette NICHT als Freigabe erkannt werden duerfen: {result.stdout}{result.stderr}"
    assert "NO_MATCH" in result.stdout


@pytest.mark.TARA_0086
def test_po_approve_workflow_uses_keyword_script():
    with open(WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "check_po_approval_keyword.sh" in content


@pytest.mark.TARA_0097
def test_entwicklungsprozess_no_incomplete_keyword_phrase_remaining():
    """TARA-0097: Keine Restvorkommen der veralteten, unvollstaendigen
    Formulierung 'PO-OK oder Freigabe erteilt' (ohne Verweis auf die
    vollstaendige Keyword-Liste) mehr in ENTWICKLUNGSPROZESS.md."""
    entwicklungsprozess = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")
    with open(entwicklungsprozess, "r", encoding="utf-8") as f:
        content = f.read()
    assert "`PO-OK` oder `Freigabe erteilt`" not in content, (
        "Veraltete, unvollstaendige Keyword-Nennung noch vorhanden - "
        "muss auf die vollstaendige Liste (P-20) verweisen"
    )
    """copilot-instructions.md muss exakt die vom Skript (TARA-0109: dessen
    Kernlogik seit dieser Story in po_approval_parser.py liegt) erkannten
    Schluesselwoerter dokumentieren."""
    with open(INSTRUCTIONS, "r", encoding="utf-8") as f:
        doc_content = f.read()
    with open(PARSER_MODULE, "r", encoding="utf-8") as f:
        parser_content = f.read()

    expected_keywords = ["PO-OK", "Freigabe erteilt", "freigegeben", "akzeptiert", "Accepted", "Ok"]
    for kw in expected_keywords:
        assert kw in doc_content, f"'{kw}' fehlt in copilot-instructions.md"
        assert re.search(re.escape(kw.lower()), parser_content, re.IGNORECASE), (
            f"'{kw}' fehlt im Erkennungs-Skript"
        )

