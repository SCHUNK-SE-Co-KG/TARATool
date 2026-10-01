"""
[TARA-0118] Tests: Erweiterte Agentenstruktur
(Requirements-Agent als eigenstaendiger Sub-Agent, Acceptance-Agent nur
dokumentiert, Process-Guard-Klarstellung "Process Explainer hat keine
Entscheidungsbefugnis")

TDD Red-Phase: Alle Tests muessen FEHLSCHLAGEN, bevor folgende Dateien
angelegt/ergaenzt wurden:
- agents/requirements_agent/REQUIREMENTS_AGENT.md (neu)
- agents/acceptance_agent/ACCEPTANCE_AGENT.md (neu, nur Rollenbeschreibung)
- agents/process_guard/PROCESS_GUARD_AGENT.md (Ergaenzung)
- docs/ENTWICKLUNGSPROZESS.md (Ergaenzung Rollen-Tabelle + Workflow)
- agents/README.md (Ergaenzung Agenten-Uebersicht)
- .github/copilot-instructions.md (Ergaenzung Referenz-Tabelle)

PO-Entscheidungen (Issue #189):
1. Requirements-Agent laeuft in einem SEPARATEN Kontext/Sub-Agent-Aufruf
   (analog Review-Agent-Unabhaengigkeit TARA-0114/#185), nicht nur als
   Modus-Wechsel im Dev-Agent.
2. Definition-of-Ready (DoR) Checkliste wird eingefuehrt (konkrete
   Kriterien analog Gate 1/Gate 2).
3. Acceptance-Agent wird NUR dokumentiert (Rollenbeschreibung), KEIN
   Code/Prototyp in diesem Epic.
4. Requirements-Agent hat KEINE fachliche Freigabebefugnis - diese bleibt
   beim PO.
"""

import os

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

REQUIREMENTS_AGENT_DOC = os.path.join(
    REPO_ROOT, "agents", "requirements_agent", "REQUIREMENTS_AGENT.md"
)
ACCEPTANCE_AGENT_DOC = os.path.join(
    REPO_ROOT, "agents", "acceptance_agent", "ACCEPTANCE_AGENT.md"
)
PROCESS_GUARD_DOC = os.path.join(REPO_ROOT, "agents", "process_guard", "PROCESS_GUARD_AGENT.md")
ENTWICKLUNGSPROZESS_DOC = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")
AGENTS_README = os.path.join(REPO_ROOT, "agents", "README.md")
COPILOT_INSTRUCTIONS = os.path.join(REPO_ROOT, ".github", "copilot-instructions.md")


def _read(path):
    assert os.path.isfile(path), f"Datei fehlt: {path}"
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


class TestRequirementsAgentDoc:
    def test_file_exists(self):
        assert os.path.isfile(REQUIREMENTS_AGENT_DOC)

    def test_describes_role_purpose(self):
        content = _read(REQUIREMENTS_AGENT_DOC)
        assert "Requirements-Agent" in content
        assert "Akzeptanzkriterien" in content

    def test_explicit_no_approval_authority(self):
        """Requirements-Agent darf NICHT fachlich freigeben (bleibt PO-Aufgabe)."""
        content = _read(REQUIREMENTS_AGENT_DOC).lower()
        assert "keine fachliche freigabe" in content
        assert "po" in content

    def test_requires_separate_context(self):
        """Muss in separatem Agenten-Kontext laufen, analog Review-Agent (TARA-0114)."""
        content = _read(REQUIREMENTS_AGENT_DOC)
        assert "separat" in content.lower()
        assert "TARA-0114" in content or "TARA-0107" in content

    def test_contains_definition_of_ready_reference(self):
        content = _read(REQUIREMENTS_AGENT_DOC)
        assert "Definition of Ready" in content or "DoR" in content

    def test_handoff_to_dev_agent_documented(self):
        content = _read(REQUIREMENTS_AGENT_DOC)
        assert "Dev-Agent" in content


class TestAcceptanceAgentDoc:
    def test_file_exists(self):
        assert os.path.isfile(ACCEPTANCE_AGENT_DOC)

    def test_describes_role_conceptually(self):
        content = _read(ACCEPTANCE_AGENT_DOC)
        assert "Acceptance-Agent" in content

    def test_explicitly_documentation_only_no_code(self):
        content = _read(ACCEPTANCE_AGENT_DOC).lower()
        assert "nur dokumentiert" in content or "dokumentations" in content or (
            "kein" in content and "code" in content
        )

    def test_final_decision_stays_with_po(self):
        content = _read(ACCEPTANCE_AGENT_DOC)
        assert "PO" in content
        assert "P-25" in content or "P-26" in content or "P-27" in content


class TestProcessGuardClarification:
    def test_process_explainer_has_no_decision_authority(self):
        content = _read(PROCESS_GUARD_DOC)
        assert "Process Explainer" in content
        assert "keine Entscheidungsbefugnis" in content or "trifft keine Entscheidung" in content


class TestEntwicklungsprozessUpdated:
    def test_requirements_agent_in_role_table(self):
        content = _read(ENTWICKLUNGSPROZESS_DOC)
        assert "Requirements-Agent" in content

    def test_acceptance_agent_mentioned(self):
        content = _read(ENTWICKLUNGSPROZESS_DOC)
        assert "Acceptance-Agent" in content

    def test_workflow_mentions_requirements_step(self):
        content = _read(ENTWICKLUNGSPROZESS_DOC)
        assert "Requirements-Agent" in content
        # Workflow-Schritt muss vor dem Dev-Agent-Setup auftauchen bzw.
        # im Abschnitt 4 (Story-Workflow) referenziert sein
        assert "REQUIREMENTS_AGENT.md" in content


class TestAgentsReadmeUpdated:
    def test_requirements_agent_listed(self):
        content = _read(AGENTS_README)
        assert "Requirements-Agent" in content
        assert "requirements_agent/REQUIREMENTS_AGENT.md" in content

    def test_acceptance_agent_listed(self):
        content = _read(AGENTS_README)
        assert "Acceptance-Agent" in content
        assert "acceptance_agent/ACCEPTANCE_AGENT.md" in content


class TestCopilotInstructionsUpdated:
    def test_requirements_agent_reference_present(self):
        content = _read(COPILOT_INSTRUCTIONS)
        assert "requirements_agent/REQUIREMENTS_AGENT.md" in content


class TestConsistencyWithExistingRoles:
    """Bestehende Rollenbeschreibungen duerfen durch TARA-0118 nicht
    widersprochen werden (Dev-Agent/Review-Agent/Prozess-Guard-Scope bleibt
    wie in TARA-0107 bis TARA-0117 akzeptiert)."""

    def test_dev_agent_doc_still_has_no_requirements_scope_expansion(self):
        dev_agent_doc = os.path.join(
            REPO_ROOT, "agents", "dev_agent", "DEV_AGENT_ONBOARDING.md"
        )
        content = _read(dev_agent_doc)
        # Dev-Agent-Dokument darf weiterhin existieren/unveraendert referenzierbar sein
        assert "Dev-Agent" in content

    def test_review_agent_independence_still_documented(self):
        review_agent_doc = os.path.join(
            REPO_ROOT, "agents", "review_agent", "REVIEW_AGENT_WORKFLOW.md"
        )
        content = _read(review_agent_doc)
        assert "Unabhaengig" in content or "unabhaengig" in content.lower()

    def test_requirements_agent_doc_does_not_claim_approval_authority(self):
        """Die neue Requirements-Agent-Doku darf an keiner Stelle eine
        fachliche Freigabebefugnis fuer sich beanspruchen - diese Formulierung
        waere ein direkter Widerspruch zur PO-Entscheidung in Issue #189."""
        content = _read(REQUIREMENTS_AGENT_DOC).lower()
        forbidden_phrases = [
            "requirements-agent gibt die freigabe",
            "requirements-agent genehmigt",
            "requirements-agent entscheidet ueber die freigabe",
        ]
        for phrase in forbidden_phrases:
            assert phrase not in content, "Unzulaessige Formulierung gefunden: " + phrase
        assert "keine fachliche freigabe" in content

    def test_acceptance_agent_doc_does_not_claim_approval_authority(self):
        """Die Acceptance-Agent-Doku darf keine eigene Freigabebefugnis
        beanspruchen (PO-Entscheidung Issue #189: nur dokumentiert)."""
        content = _read(ACCEPTANCE_AGENT_DOC).lower()
        forbidden_phrases = [
            "acceptance-agent entscheidet",
            "acceptance-agent genehmigt",
            "acceptance-agent gibt frei",
        ]
        for phrase in forbidden_phrases:
            assert phrase not in content, "Unzulaessige Formulierung gefunden: " + phrase
        assert (
            "keine eigene freigabeentscheidung" in content
            or "keine eigene freigabebefugnis" in content
        )

    def test_markdown_links_to_new_docs_are_well_formed(self):
        """Regression gegen TARA-0118-Review-Finding: kaputte Markdown-Links
        (z.B. fehlende/verrutschte Backticks) auf die neuen Agenten-Dateien."""
        for doc_path in (ENTWICKLUNGSPROZESS_DOC, AGENTS_README, COPILOT_INSTRUCTIONS):
            content = _read(doc_path)
            well_formed = (
                "`agents/requirements_agent/REQUIREMENTS_AGENT.md`" in content
                or "requirements_agent/REQUIREMENTS_AGENT.md)" in content
            )
            assert well_formed, "Kein wohlgeformter Link/Codeblock in " + doc_path
