"""TARA-0061: Code Duplication Detection - Exact, Logical, and Configuration Duplicates (R-39)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


# ==============================================================================
# Tests for Duplication Detector - Exact Duplication
# ==============================================================================

@pytest.mark.TARA_0061
def test_detect_exact_code_duplication():
    """TARA-0061: Detect exact code duplication in multiple files."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()

    # Two identical code blocks
    code_blocks = [
        {"file": "file1.js", "content": "const x = document.getElementById('btn');\nx.addEventListener('click', handler);", "start_line": 10},
        {"file": "file2.js", "content": "const x = document.getElementById('btn');\nx.addEventListener('click', handler);", "start_line": 42},
    ]

    findings = detector.detect_exact_duplicates(code_blocks)

    assert len(findings) > 0, "Should detect exact duplicates"
    assert findings[0]["type"] == "exact_duplication"
    assert findings[0]["rule_reference"] == "R-39"
    assert "file1.js" in findings[0]["affected_locations"] or "file1.js" in str(findings[0])
    assert "file2.js" in findings[0]["affected_locations"] or "file2.js" in str(findings[0])


@pytest.mark.TARA_0061
def test_no_false_positives_for_similar_but_different():
    """TARA-0061: Similar code with minor differences should not be exact duplicates."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()

    code_blocks = [
        {"file": "file1.js", "content": "const x = document.getElementById('btn');\nx.addEventListener('click', handler);", "start_line": 10},
        {"file": "file2.js", "content": "const x = document.getElementById('button');\nx.addEventListener('click', handler);", "start_line": 42},
    ]

    findings = detector.detect_exact_duplicates(code_blocks)

    # Should not detect as exact duplicate (different element ID)
    exact_dupes = [f for f in findings if f.get("type") == "exact_duplication"]
    assert len(exact_dupes) == 0, "Should not report similar code as exact duplicates"


@pytest.mark.TARA_0061
def test_detect_structural_pattern_duplication():
    """TARA-0061: Detect structural/logical pattern duplication."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()

    # Structurally similar but semantically different patterns
    code_blocks = [
        {"file": "file1.js", "content": "if (x) {\n  console.log('error');\n  return false;\n}", "start_line": 10},
        {"file": "file2.js", "content": "if (y) {\n  console.log('error');\n  return false;\n}", "start_line": 42},
    ]

    findings = detector.detect_structural_duplicates(code_blocks, similarity_threshold=0.7)

    assert len(findings) > 0, "Should detect structural duplicates"
    assert findings[0]["type"] == "structural_duplication"
    assert findings[0]["rule_reference"] == "R-39"


@pytest.mark.TARA_0061
def test_detect_config_duplication():
    """TARA-0061: Detect configuration duplication."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()

    # Identical config blocks
    config_blocks = [
        {"file": "config1.js", "content": "const config = {\n  apiUrl: 'https://api.example.com',\n  timeout: 5000,\n  retries: 3\n};", "start_line": 1},
        {"file": "config2.js", "content": "const config = {\n  apiUrl: 'https://api.example.com',\n  timeout: 5000,\n  retries: 3\n};", "start_line": 5},
    ]

    findings = detector.detect_config_duplicates(config_blocks)

    assert len(findings) > 0, "Should detect config duplicates"
    assert findings[0]["type"] == "config_duplication"
    assert findings[0]["rule_reference"] == "R-39"


@pytest.mark.TARA_0061
def test_finding_has_required_fields():
    """TARA-0061: Each duplication finding must have required fields."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()

    code_blocks = [
        {"file": "file1.js", "content": "const x = 1;", "start_line": 10},
        {"file": "file2.js", "content": "const x = 1;", "start_line": 20},
    ]

    findings = detector.detect_exact_duplicates(code_blocks)

    assert len(findings) > 0
    finding = findings[0]

    # Required fields per TARA-0062
    assert "codezeile_or_spur" in finding or "affected_locations" in finding
    assert "rule_reference" in finding
    assert finding["rule_reference"] == "R-39"
    assert "severity" in finding
    assert "confidence" in finding
    assert "description" in finding
    assert "evidence" in finding


@pytest.mark.TARA_0061
def test_affected_locations_format():
    """TARA-0061: Affected locations should list all duplicate occurrences."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()

    code_blocks = [
        {"file": "file1.js", "content": "function handler() { return true; }", "start_line": 5},
        {"file": "file2.js", "content": "function handler() { return true; }", "start_line": 15},
        {"file": "file3.js", "content": "function handler() { return true; }", "start_line": 25},
    ]

    findings = detector.detect_exact_duplicates(code_blocks)

    assert len(findings) > 0
    finding = findings[0]
    
    locations = finding.get("affected_locations", [])
    assert len(locations) >= 2, "Should list all duplicate locations"


@pytest.mark.TARA_0061
def test_empty_input_returns_no_findings():
    """TARA-0061: Empty or None input should return no findings."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()

    # Test with empty list
    findings = detector.detect_exact_duplicates([])
    assert findings == []

    # Test with single item
    findings = detector.detect_exact_duplicates([{"file": "file1.js", "content": "code", "start_line": 1}])
    assert findings == []


@pytest.mark.TARA_0061
def test_detector_initialization():
    """TARA-0061: DuplicationDetector should initialize without errors."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()
    assert detector is not None
    assert hasattr(detector, "detect_exact_duplicates")
    assert hasattr(detector, "detect_structural_duplicates")
    assert hasattr(detector, "detect_config_duplicates")


@pytest.mark.TARA_0061
def test_multiple_line_blocks_exact_match():
    """TARA-0061: Multi-line code blocks should match exactly across files."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()

    # Multi-line event handler duplication
    code_blocks = [
        {
            "file": "handlers.js",
            "content": "function setupButton() {\n  const btn = document.getElementById('save');\n  btn.addEventListener('click', () => {\n    saveData();\n  });\n}",
            "start_line": 10,
            "lines": 5
        },
        {
            "file": "ui.js",
            "content": "function setupButton() {\n  const btn = document.getElementById('save');\n  btn.addEventListener('click', () => {\n    saveData();\n  });\n}",
            "start_line": 42,
            "lines": 5
        },
    ]

    findings = detector.detect_exact_duplicates(code_blocks)

    assert len(findings) > 0, "Should detect multi-line exact duplicates"
    assert findings[0]["type"] == "exact_duplication"


@pytest.mark.TARA_0061
def test_severity_and_confidence_levels():
    """TARA-0061: Duplication findings should have appropriate severity/confidence."""
    from agents.review_agent.duplication_detector import DuplicationDetector

    detector = DuplicationDetector()

    code_blocks = [
        {"file": "file1.js", "content": "const x = 1;", "start_line": 10},
        {"file": "file2.js", "content": "const x = 1;", "start_line": 20},
    ]

    findings = detector.detect_exact_duplicates(code_blocks)

    assert len(findings) > 0
    finding = findings[0]

    # Exact duplicates should have high confidence
    assert finding["confidence"] in ["High", "high", "HIGH"]

    # Exact duplicates are at least Niedrig severity
    assert finding["severity"] in ["Niedrig", "Mittel", "Hoch", "Kritisch"]
