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
"""
import os
import re
import subprocess
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(REPO_ROOT, "scripts", "process_guard", "check_po_approval_keyword.sh")
WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "po-approve.yml")
INSTRUCTIONS = os.path.join(REPO_ROOT, ".github", "copilot-instructions.md")


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
        "PO-OK",
        "po-ok bitte umsetzen",
        "Freigabe erteilt fuer TARA-0086",
        "freigabe erteilt",
        "freigegeben, danke",
        "Ich habe es akzeptiert",
        "Accepted, thanks!",
        "Ok",
        "OK passt",
        "ok, mach das",
    ],
)
def test_recognizes_valid_po_approval_keywords(comment):
    result = _run_check(comment)
    assert result.returncode == 0, f"'{comment}' haette erkannt werden muessen: {result.stdout}{result.stderr}"
    assert "MATCH" in result.stdout


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


@pytest.mark.TARA_0096
@pytest.mark.parametrize(
    "comment",
    [
        "Bitte NICHT ok geben",
        "das ist NICHT OK fuer mich",
        "Nicht ok, bitte nochmal",
        "kein OK",
        "keine ok",
        "not ok",
    ],
)
def test_rejects_negated_approval_phrases(comment):
    """TARA-0096: Eine explizite Ablehnung (Negation unmittelbar vor dem
    Freigabe-Keyword) darf NICHT als gueltige Freigabe gewertet werden."""
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
    """copilot-instructions.md muss exakt die vom Skript erkannten Schluesselwoerter dokumentieren."""
    with open(INSTRUCTIONS, "r", encoding="utf-8") as f:
        doc_content = f.read()
    with open(SCRIPT, "r", encoding="utf-8") as f:
        script_content = f.read()

    expected_keywords = ["PO-OK", "Freigabe erteilt", "freigegeben", "akzeptiert", "Accepted", "Ok"]
    for kw in expected_keywords:
        assert kw in doc_content, f"'{kw}' fehlt in copilot-instructions.md"
        assert re.search(re.escape(kw.lower()), script_content, re.IGNORECASE), (
            f"'{kw}' fehlt im Erkennungs-Skript"
        )
