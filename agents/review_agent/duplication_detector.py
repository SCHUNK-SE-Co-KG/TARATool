"""TARA-0061: Code Duplication Detector - Exact, Structural, and Configuration Duplicates (R-39).

This module implements deep static analysis for code duplication detection, supporting:
- Exact duplication: Identical code blocks across files
- Structural duplication: Logically similar patterns that differ in variable names/constants
- Configuration duplication: Duplicate configuration objects/settings

Usage:
    detector = DuplicationDetector()
    
    # Detect exact duplicates
    findings = detector.detect_exact_duplicates(code_blocks)
    
    # Detect structural patterns
    findings = detector.detect_structural_duplicates(code_blocks, similarity_threshold=0.70)
    
    # Detect config duplicates
    findings = detector.detect_config_duplicates(config_blocks)
    
    # Or detect all types at once
    findings = detector.detect_all_duplicates(code_blocks)

Output format (per TARA-0062 Finding Framework):
    - type: 'exact_duplication', 'structural_duplication', or 'config_duplication'
    - rule_reference: 'R-39'
    - codezeile_or_spur: Location in first duplicate (e.g., 'lines 10-14 in file.js')
    - affected_locations: List of all duplicate locations
    - severity: 'Mittel' (exact), 'Niedrig' (structural/config)
    - confidence: 'High' (exact/config), 'Medium' (structural)
    - description: Human-readable issue description
    - evidence: Concrete proof of duplication
"""
from __future__ import annotations

import difflib
import re
from typing import Optional

from agents.review_agent.finding_framework import Confidence, Finding, Severity


class DuplicationDetector:
    """
    TARA-0061: Detect code duplicates at multiple levels.

    Supports:
    - Exact duplication: Identical code blocks
    - Structural duplication: Similar logical patterns
    - Configuration duplication: Duplicate configuration blocks
    """

    def __init__(self):
        """Initialize the duplication detector."""
        self.min_block_size = 3  # Minimum lines to consider as duplication
        self.exact_similarity_threshold = 0.95  # 95% for exact duplicates
        self.structural_similarity_threshold = 0.70  # 70% for structural patterns

    def detect_exact_duplicates(self, code_blocks: list[dict]) -> list[dict]:
        """
        Detect exact code duplicates across multiple code blocks.

        Args:
            code_blocks: List of dicts with 'file', 'content', 'start_line', optional 'lines'

        Returns:
            List of finding dicts with type='exact_duplication', locations, rule_reference='R-39'
        """
        if not code_blocks or len(code_blocks) < 2:
            return []

        findings = []
        seen_hashes = {}

        # Group code blocks by content hash
        for block in code_blocks:
            content = block.get("content", "").strip()
            if not content:
                continue

            # Create a hash of normalized content
            content_hash = self._normalize_and_hash(content)

            if content_hash not in seen_hashes:
                seen_hashes[content_hash] = []
            seen_hashes[content_hash].append(block)

        # Find duplicates (same hash in multiple blocks)
        for content_hash, blocks in seen_hashes.items():
            if len(blocks) >= 2:
                # Found duplicates
                finding = self._create_exact_duplicate_finding(blocks)
                findings.append(finding)

        return findings

    def detect_structural_duplicates(
        self,
        code_blocks: list[dict],
        similarity_threshold: float = 0.70,
    ) -> list[dict]:
        """
        Detect structural/logical pattern duplicates.

        Similar patterns that are not exactly identical but follow the same structure.

        Args:
            code_blocks: List of code block dicts
            similarity_threshold: Similarity ratio threshold (0.0-1.0)

        Returns:
            List of finding dicts with type='structural_duplication'
        """
        if not code_blocks or len(code_blocks) < 2:
            return []

        findings = []
        checked_pairs = set()

        for i, block_a in enumerate(code_blocks):
            for j, block_b in enumerate(code_blocks[i + 1 :], start=i + 1):
                pair_key = (i, j)
                if pair_key in checked_pairs:
                    continue
                checked_pairs.add(pair_key)

                content_a = block_a.get("content", "").strip()
                content_b = block_b.get("content", "").strip()

                if not content_a or not content_b:
                    continue

                # Skip if already exact duplicates
                if self._normalize_and_hash(content_a) == self._normalize_and_hash(
                    content_b
                ):
                    continue

                # Normalize for structural comparison
                normalized_a = self._normalize_for_structural_comparison(content_a)
                normalized_b = self._normalize_for_structural_comparison(content_b)

                # Calculate similarity
                similarity = difflib.SequenceMatcher(
                    None, normalized_a, normalized_b
                ).ratio()

                if similarity >= similarity_threshold:
                    finding = self._create_structural_duplicate_finding(
                        [block_a, block_b], similarity
                    )
                    findings.append(finding)

        return findings

    def detect_config_duplicates(self, config_blocks: list[dict]) -> list[dict]:
        """
        Detect configuration duplication.

        Identifies duplicate config objects or settings blocks.

        Args:
            config_blocks: List of config block dicts

        Returns:
            List of finding dicts with type='config_duplication'
        """
        if not config_blocks or len(config_blocks) < 2:
            return []

        findings = []
        seen_hashes = {}

        for block in config_blocks:
            content = block.get("content", "").strip()
            if not content:
                continue

            # Normalize config for comparison (remove whitespace variations)
            normalized = self._normalize_config(content)
            content_hash = hash(normalized)

            if content_hash not in seen_hashes:
                seen_hashes[content_hash] = []
            seen_hashes[content_hash].append(block)

        # Find duplicates
        for content_hash, blocks in seen_hashes.items():
            if len(blocks) >= 2:
                finding = self._create_config_duplicate_finding(blocks)
                findings.append(finding)

        return findings

    def _normalize_and_hash(self, content: str) -> str:
        """Normalize code content and create a hash."""
        # Remove extra whitespace and comments
        lines = content.split("\n")
        normalized_lines = []

        for line in lines:
            # Remove single-line comments (basic)
            if "//" in line:
                line = line.split("//")[0]
            # Remove leading/trailing whitespace
            line = line.strip()
            if line:
                normalized_lines.append(line)

        normalized = "\n".join(normalized_lines)
        return str(hash(normalized))

    def _normalize_for_structural_comparison(self, content: str) -> str:
        """Normalize code for structural pattern comparison."""
        # Replace variable names, strings, and numbers with placeholders
        content = re.sub(r"'[^']*'", "'STR'", content)  # Single-quoted strings
        content = re.sub(r'"[^"]*"', '"STR"', content)  # Double-quoted strings
        content = re.sub(r"`[^`]*`", "`STR`", content)  # Template literals
        content = re.sub(r"\b[a-zA-Z_]\w*\b", "VAR", content)  # Variable names
        content = re.sub(r"\d+", "NUM", content)  # Numbers

        # Remove extra whitespace
        lines = content.split("\n")
        lines = [line.strip() for line in lines if line.strip()]
        return "\n".join(lines)

    def _normalize_config(self, content: str) -> str:
        """Normalize configuration content for comparison."""
        # Remove whitespace variations
        content = re.sub(r"\s+", " ", content)
        content = re.sub(r":\s+", ":", content)
        content = re.sub(r",\s+", ",", content)
        content = re.sub(r"\{\s+", "{", content)
        content = re.sub(r"\s+\}", "}", content)
        return content.lower().strip()

    def _create_exact_duplicate_finding(self, blocks: list[dict]) -> dict:
        """Create a finding for exact code duplication."""
        locations = self._format_locations(blocks)
        codezeile = self._format_codezeile(blocks[0])

        # Create multiple line references
        affected_lines = []
        for block in blocks:
            file = block.get("file", "unknown")
            start = block.get("start_line", 0)
            num_lines = block.get("lines", 1)
            if num_lines > 1:
                affected_lines.append(f"{file}:{start}-{start + num_lines - 1}")
            else:
                affected_lines.append(f"{file}:{start}")

        evidence = f"Code appears in multiple locations: {', '.join(affected_lines)}"

        finding_dict = {
            "type": "exact_duplication",
            "rule_reference": "R-39",
            "codezeile_or_spur": codezeile,
            "affected_locations": locations,
            "severity": "Mittel",
            "confidence": "High",
            "description": f"Exact code duplication detected across {len(blocks)} locations",
            "evidence": evidence,
        }

        return finding_dict

    def _create_structural_duplicate_finding(
        self, blocks: list[dict], similarity: float
    ) -> dict:
        """Create a finding for structural pattern duplication."""
        locations = self._format_locations(blocks)
        codezeile = self._format_codezeile(blocks[0])

        finding_dict = {
            "type": "structural_duplication",
            "rule_reference": "R-39",
            "codezeile_or_spur": codezeile,
            "affected_locations": locations,
            "severity": "Niedrig",
            "confidence": "Medium",
            "description": f"Structural pattern duplication detected (similarity: {similarity:.0%})",
            "evidence": f"Similar code patterns found in {locations[0]} and {locations[1]}",
        }

        return finding_dict

    def _create_config_duplicate_finding(self, blocks: list[dict]) -> dict:
        """Create a finding for configuration duplication."""
        locations = self._format_locations(blocks)
        codezeile = self._format_codezeile(blocks[0])

        finding_dict = {
            "type": "config_duplication",
            "rule_reference": "R-39",
            "codezeile_or_spur": codezeile,
            "affected_locations": locations,
            "severity": "Niedrig",
            "confidence": "High",
            "description": f"Configuration duplication detected across {len(blocks)} files",
            "evidence": f"Identical configuration found in: {', '.join(locations)}",
        }

        return finding_dict

    def _format_locations(self, blocks: list[dict]) -> list[str]:
        """Format locations from code blocks."""
        locations = []
        for block in blocks:
            file = block.get("file", "unknown")
            start = block.get("start_line", 0)
            locations.append(f"{file}:{start}")
        return locations

    def _format_codezeile(self, block: dict) -> str:
        """Format codezeile from a single block."""
        file = block.get("file", "unknown")
        start = block.get("start_line", 0)
        num_lines = block.get("lines", 1)

        if num_lines > 1:
            return f"lines {start}-{start + num_lines - 1} in {file}"
        return f"line {start} in {file}"

    def detect_all_duplicates(self, code_blocks: list[dict]) -> list[dict]:
        """
        Detect all types of duplicates in a set of code blocks.

        Args:
            code_blocks: List of code block dicts

        Returns:
            Combined list of all duplicate findings
        """
        findings = []

        # Detect exact duplicates first
        findings.extend(self.detect_exact_duplicates(code_blocks))

        # Detect structural patterns (only for blocks that aren't exact duplicates)
        structural = self.detect_structural_duplicates(
            code_blocks, self.structural_similarity_threshold
        )
        findings.extend(structural)

        return findings
