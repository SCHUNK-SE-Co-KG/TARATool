"""Tests fuer TARA-0109: PO-Freigabe zu leicht ausloesbar - gebundenes
Freigabe-Kommando statt loser Keywords.

Ersetzt die bisherige lose Schluesselwort-Erkennung (jedes eigenstaendige
Vorkommen von z.B. "OK" im Kommentar, unabhaengig vom Kontext) durch ein an
eine konkrete TARA-ID gebundenes Kommando (z.B. "akzeptiert TARA-0107" oder
"TARA-0107 akzeptiert"). Ausserdem wird die TARA-ID nun aus dem
Freigabe-Kommentar selbst entnommen statt pauschal aus Issue-Titel/Body, und
zitierte/eingebettete Texte (Blockquote, Code-Fence) werden nicht mehr als
aktives Kommando gewertet.
"""
import os
import subprocess
import sys
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts", "process_guard")
WRAPPER_SCRIPT = os.path.join(SCRIPTS_DIR, "check_po_approval_keyword.sh")
PARSER_MODULE_PATH = os.path.join(SCRIPTS_DIR, "po_approval_parser.py")
PO_APPROVE_WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "po-approve.yml")
COPILOT_INSTRUCTIONS = os.path.join(REPO_ROOT, ".github", "copilot-instructions.md")
PROCESS_GUARD_DOC = os.path.join(REPO_ROOT, "agents", "process_guard", "PROCESS_GUARD_AGENT.md")
REVIEW_AGENT_DOC = os.path.join(REPO_ROOT, "agents", "review_agent", "REVIEW_AGENT_WORKFLOW.md")


def _to_bash_path(path):
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_wrapper(comment_body):
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as f:
        f.write(comment_body)
        comment_file = f.name
    try:
        result = subprocess.run(
            ["bash", _to_bash_path(WRAPPER_SCRIPT), _to_bash_path(comment_file)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result
    finally:
        os.remove(comment_file)


@pytest.fixture()
def parser_module():
    sys.path.insert(0, SCRIPTS_DIR)
    import po_approval_parser  # noqa: E402

    yield po_approval_parser
    sys.path.remove(SCRIPTS_DIR)
    sys.modules.pop("po_approval_parser", None)


# ---------------------------------------------------------------------------
# Existenz
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0109
def test_parser_module_exists():
    assert os.path.isfile(PARSER_MODULE_PATH)


@pytest.mark.TARA_0109
def test_wrapper_script_exists():
    assert os.path.isfile(WRAPPER_SCRIPT)


# ---------------------------------------------------------------------------
# Unit-Tests: extract_approved_tara_ids
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0109
def test_bound_command_keyword_before_id_matches(parser_module):
    ids = parser_module.extract_approved_tara_ids("akzeptiert TARA-0109")
    assert ids == ["TARA-0109"]


@pytest.mark.TARA_0109
def test_bound_command_id_before_keyword_matches(parser_module):
    ids = parser_module.extract_approved_tara_ids("TARA-0109 akzeptiert")
    assert ids == ["TARA-0109"]


@pytest.mark.TARA_0109
def test_bound_command_with_connector_words_matches(parser_module):
    ids = parser_module.extract_approved_tara_ids("TARA-0109 ist nun akzeptiert")
    assert ids == ["TARA-0109"]


@pytest.mark.TARA_0109
def test_false_positive_example_from_story_is_rejected(parser_module):
    """Konkretes Beispiel aus der Story: 'OK' matcht als eigenstaendiges Wort,
    aber es gibt keine an dieses Wort gebundene TARA-ID -> kein Match."""
    ids = parser_module.extract_approved_tara_ids(
        "Der Test ist OK, aber die Story ist noch nicht freigegeben."
    )
    assert ids == []


@pytest.mark.TARA_0109
def test_negation_directly_before_keyword_is_rejected(parser_module):
    ids = parser_module.extract_approved_tara_ids("nicht akzeptiert TARA-0109")
    assert ids == []


@pytest.mark.TARA_0109
def test_multiple_bound_commands_all_matched(parser_module):
    ids = parser_module.extract_approved_tara_ids(
        "akzeptiert TARA-0108, akzeptiert TARA-0109"
    )
    assert ids == ["TARA-0108", "TARA-0109"]


@pytest.mark.TARA_0109
def test_id_mentioned_far_from_keyword_is_not_bound(parser_module):
    ids = parser_module.extract_approved_tara_ids(
        "akzeptiert. Wir hatten letzte Woche schon einmal ganz allgemein "
        "ueber das Vorgehen bei TARA-0110 gesprochen, ohne Ergebnis."
    )
    assert ids == []


@pytest.mark.TARA_0109
def test_blockquote_line_is_ignored(parser_module):
    ids = parser_module.extract_approved_tara_ids("> akzeptiert TARA-0109")
    assert ids == []


@pytest.mark.TARA_0109
def test_code_fence_content_is_ignored(parser_module):
    ids = parser_module.extract_approved_tara_ids(
        "```\nakzeptiert TARA-0109\n```"
    )
    assert ids == []


@pytest.mark.TARA_0109
def test_blockquote_does_not_suppress_later_active_line(parser_module):
    ids = parser_module.extract_approved_tara_ids(
        "> Zitat: akzeptiert TARA-0110\nakzeptiert TARA-0109"
    )
    assert ids == ["TARA-0109"]


@pytest.mark.TARA_0109
def test_keyword_and_id_across_sentence_boundary_not_bound(parser_module):
    """Review-Finding PR #194: Bindung darf nicht ueber Satzgrenzen (.!?)
    hinweg erfolgen."""
    ids = parser_module.extract_approved_tara_ids(
        "Sieht ok aus. TARA-0109 bitte nochmal pruefen und Tests ergaenzen."
    )
    assert ids == []


@pytest.mark.TARA_0109
def test_keyword_and_id_across_paragraph_boundary_not_bound(parser_module):
    """Review-Finding PR #194: Bindung darf nicht ueber Absatzgrenzen
    (Leerzeile) hinweg erfolgen."""
    ids = parser_module.extract_approved_tara_ids(
        "OK\n\nTARA-0109 needs more work, not approved yet."
    )
    assert ids == []


@pytest.mark.TARA_0109
def test_negation_with_extra_filler_word_still_rejected(parser_module):
    """Review-Finding PR #194: Ein zusaetzliches Fuellwort zwischen Negation
    und Keyword darf die Negations-Ausnahme (TARA-0096) nicht umgehen."""
    ids = parser_module.extract_approved_tara_ids("nicht wirklich akzeptiert TARA-0109")
    assert ids == []


@pytest.mark.TARA_0109
def test_indented_code_block_ignored(parser_module):
    """Review-Finding PR #194: 4-Leerzeichen-eingerueckte Code-Bloecke
    (GFM-Konvention) muessen wie Code-Fences ignoriert werden."""
    ids = parser_module.extract_approved_tara_ids("    akzeptiert TARA-0109")
    assert ids == []


@pytest.mark.TARA_0109
def test_multiple_ids_before_keyword_all_matched(parser_module):
    """Review-Finding PR #194: Eine ID-Liste vor dem Keyword muss vollstaendig
    gebunden werden, nicht nur die naechstgelegene ID."""
    ids = parser_module.extract_approved_tara_ids("TARA-0108 und TARA-0109 akzeptiert")
    assert ids == ["TARA-0108", "TARA-0109"]


@pytest.mark.TARA_0109
def test_multiple_ids_after_keyword_all_matched(parser_module):
    ids = parser_module.extract_approved_tara_ids("akzeptiert TARA-0108, TARA-0109")
    assert ids == ["TARA-0108", "TARA-0109"]


# ---------------------------------------------------------------------------
# Wrapper-Skript (Bash)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0109
def test_wrapper_matches_and_prints_id():
    result = _run_wrapper("akzeptiert TARA-0109")
    assert result.returncode == 0
    assert "TARA-0109" in result.stdout



@pytest.mark.TARA_0109
def test_wrapper_no_match_exits_nonzero():
    result = _run_wrapper("Der Test ist OK, aber die Story ist noch nicht freigegeben.")
    assert result.returncode == 1


# ---------------------------------------------------------------------------
# Workflow/Doku-Konsistenz
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0109
def test_po_approve_workflow_calls_parser_for_comment_ids():
    with open(PO_APPROVE_WORKFLOW, encoding="utf-8") as f:
        content = f.read()
    assert "po_approval_parser" in content or "check_po_approval_keyword.sh" in content
    # Duerfen keine reine Titel/Body-Pauschalextraktion mehr enthalten
    assert "issueTitle + ' ' + issueBody" not in content


@pytest.mark.TARA_0109
def test_copilot_instructions_document_bound_format():
    with open(COPILOT_INSTRUCTIONS, encoding="utf-8") as f:
        content = f.read()
    assert "TARA-XXXX" in content
    assert "akzeptiert TARA-" in content


@pytest.mark.TARA_0109
def test_process_guard_doc_describes_bound_command():
    with open(PROCESS_GUARD_DOC, encoding="utf-8") as f:
        content = f.read()
    assert "TARA-0109" in content


@pytest.mark.TARA_0109
def test_review_agent_doc_references_bound_format():
    with open(REVIEW_AGENT_DOC, encoding="utf-8") as f:
        content = f.read()
    assert "TARA-0109" in content
