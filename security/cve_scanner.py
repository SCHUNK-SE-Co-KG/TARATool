#!/usr/bin/env python3
"""
CVE-Scanner für das TARATool-Repository.

Scannt JavaScript-CDN-Abhängigkeiten (aus index.html) sowie
Python-Abhängigkeiten (aus tests/requirements.txt) gegen die
Google OSV API (https://osv.dev) auf bekannte Sicherheitslücken.

Ergebnisse werden als Markdown-Report und JSON unter
security/reports/ abgelegt.

Verwendung:
    python security/cve_scanner.py                # Scan + Report
    python security/cve_scanner.py --json-only    # Nur JSON-Ausgabe

Voraussetzungen:
    Python 3.9+, requests (pip install requests)

Autor:  TARATool Security Tooling
Lizenz: GPL-3.0
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import textwrap
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    sys.exit(
        "Fehler: 'requests' ist nicht installiert.\n"
        "  pip install requests"
    )

# ── Konstanten ───────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent
INDEX_HTML = ROOT_DIR / "index.html"
REQUIREMENTS_TXT = ROOT_DIR / "tests" / "requirements.txt"
REPORT_DIR = ROOT_DIR / "security" / "reports"

OSV_QUERY_URL = "https://api.osv.dev/v1/query"
OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch"
OSV_VULN_URL = "https://api.osv.dev/v1/vulns"  # + /{id}

# Bekannte CDN-Muster → (ecosystem, package_name)
CDN_PATTERNS: list[tuple[re.Pattern, str, str]] = [
    # cdnjs.cloudflare.com/ajax/libs/<name>/<version>/...
    (
        re.compile(
            r"cdnjs\.cloudflare\.com/ajax/libs/"
            r"(?P<name>[^/]+)/(?P<version>[^/]+)"
        ),
        "npm",
        "",  # Name wird aus Regex übernommen
    ),
    # cdn.jsdelivr.net/npm/<@scope/pkg>@<version>  oder  <pkg>@<version>
    (
        re.compile(
            r"cdn\.jsdelivr\.net/npm/"
            r"(?P<name>@?[^@/]+(?:/[^@/]+)?)"
            r"(?:@(?P<version>[^/\"']+))?"
        ),
        "npm",
        "",
    ),
    # unpkg.com/<pkg>@<version>
    (
        re.compile(
            r"unpkg\.com/"
            r"(?P<name>@?[^@/]+(?:/[^@/]+)?)"
            r"@(?P<version>[^/\"']+)"
        ),
        "npm",
        "",
    ),
]

# cdnjs-Name → tatsächlicher npm-Paketname (Mapping)
CDNJS_TO_NPM: dict[str, str] = {
    "font-awesome": "@fortawesome/fontawesome-free",
    "jszip": "jszip",
    "jspdf": "jspdf",
}


# ── Datenstrukturen ─────────────────────────────────────────────────
@dataclass
class Dependency:
    """Eine erkannte Abhängigkeit."""

    name: str
    version: str
    ecosystem: str  # "npm" | "PyPI"
    source: str  # Datei, in der sie gefunden wurde


# Severity-Label → geschätzter CVSS-Basiswert
SEVERITY_LABEL_SCORES: dict[str, float] = {
    "CRITICAL": 9.5,
    "HIGH": 8.0,
    "MODERATE": 5.5,
    "MEDIUM": 5.5,
    "LOW": 2.5,
}

CVSS_HIGH_THRESHOLD = 7.0  # Ab diesem Wert wird ein Email-Alert ausgelöst


@dataclass
class Vulnerability:
    """Eine gefundene Sicherheitslücke."""

    vuln_id: str
    summary: str
    severity: str
    cvss_score: float
    affected_package: str
    affected_versions: str
    fixed_version: str
    references: list[str] = field(default_factory=list)
    aliases: list[str] = field(default_factory=list)


@dataclass
class ScanResult:
    """Gesamtergebnis eines Scan-Laufs."""

    timestamp: str
    repository: str
    dependencies_scanned: int
    vulnerabilities_found: int
    high_severity_count: int = 0
    dependencies: list[Dependency] = field(default_factory=list)
    vulnerabilities: list[Vulnerability] = field(default_factory=list)


# ── Abhängigkeiten extrahieren ───────────────────────────────────────
def extract_js_dependencies(html_path: Path) -> list[Dependency]:
    """Extrahiert JavaScript-Bibliotheken aus CDN-URLs in index.html."""
    if not html_path.exists():
        print(f"⚠  {html_path} nicht gefunden – JS-Scan übersprungen.")
        return []

    html = html_path.read_text(encoding="utf-8")
    deps: list[Dependency] = []
    seen: set[str] = set()

    for pattern, ecosystem, _ in CDN_PATTERNS:
        for m in pattern.finditer(html):
            raw_name = m.group("name")
            version = m.group("version") if "version" in m.groupdict() else None
            if not version:
                continue

            # cdnjs-Namen auf npm-Paketnamen mappen
            npm_name = CDNJS_TO_NPM.get(raw_name, raw_name)

            key = f"{ecosystem}:{npm_name}:{version}"
            if key in seen:
                continue
            seen.add(key)

            deps.append(
                Dependency(
                    name=npm_name,
                    version=version,
                    ecosystem=ecosystem,
                    source=str(html_path.relative_to(ROOT_DIR)),
                )
            )

    return deps


def extract_python_dependencies(req_path: Path) -> list[Dependency]:
    """Extrahiert Python-Pakete aus einer requirements.txt."""
    if not req_path.exists():
        print(f"⚠  {req_path} nicht gefunden – Python-Scan übersprungen.")
        return []

    deps: list[Dependency] = []
    req_re = re.compile(
        r"^(?P<name>[A-Za-z0-9_-]+)"
        r"(?:[><=!~]+(?P<version>[A-Za-z0-9_.]+))?"
    )

    for line in req_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = req_re.match(line)
        if m:
            name = m.group("name")
            version = m.group("version") or ""
            deps.append(
                Dependency(
                    name=name,
                    version=version,
                    ecosystem="PyPI",
                    source=str(req_path.relative_to(ROOT_DIR)),
                )
            )

    return deps


# ── OSV-API-Abfragen ────────────────────────────────────────────────
def _build_osv_query(dep: Dependency) -> dict:
    """Baut eine einzelne OSV-Query für eine Abhängigkeit."""
    q: dict = {"package": {"name": dep.name, "ecosystem": dep.ecosystem}}
    if dep.version:
        q["version"] = dep.version
    return q


def query_osv_batch(deps: list[Dependency]) -> list[list[dict]]:
    """Sendet einen Batch-Query an die OSV-API."""
    if not deps:
        return []

    queries = [_build_osv_query(d) for d in deps]
    try:
        resp = requests.post(
            OSV_BATCH_URL,
            json={"queries": queries},
            timeout=30,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        return [r.get("vulns", []) for r in results]
    except requests.RequestException as exc:
        print(f"⚠  OSV-API Batch-Fehler ({exc}) – falle auf Einzel-Queries zurück …")
        return _query_osv_individual(deps)


def _query_osv_individual(deps: list[Dependency]) -> list[list[dict]]:
    """Fallback: Einzelne OSV-Queries pro Abhängigkeit."""
    results: list[list[dict]] = []
    for dep in deps:
        try:
            resp = requests.post(
                OSV_QUERY_URL,
                json=_build_osv_query(dep),
                timeout=15,
            )
            resp.raise_for_status()
            vulns = resp.json().get("vulns", [])
            results.append(vulns)
        except requests.RequestException:
            results.append([])
    return results


def fetch_vuln_details(vuln_id: str) -> Optional[dict]:
    """Ruft vollständige Vulnerability-Details von der OSV-API ab."""
    try:
        resp = requests.get(f"{OSV_VULN_URL}/{vuln_id}", timeout=15)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException:
        return None


def enrich_vulnerabilities(vulns_per_dep: list[list[dict]]) -> list[list[dict]]:
    """Reichert Batch-Ergebnisse mit vollen Details an."""
    enriched: list[list[dict]] = []
    for dep_vulns in vulns_per_dep:
        enriched_list: list[dict] = []
        for v in dep_vulns:
            vuln_id = v.get("id", "")
            # Wenn Summary/Details fehlen, Voll-Abfrage machen
            if not v.get("summary") and not v.get("details"):
                full = fetch_vuln_details(vuln_id)
                if full:
                    enriched_list.append(full)
                    continue
            enriched_list.append(v)
        enriched.append(enriched_list)
    return enriched


# ── Vulnerabilities parsen ──────────────────────────────────────────
def _extract_severity(vuln: dict) -> str:
    """Extrahiert den Schweregrad aus einer OSV-Vulnerability."""
    severity_entries = vuln.get("severity", [])
    for s in severity_entries:
        score_str = s.get("score", "")
        if score_str:
            return score_str
    # Alternativ aus database_specific
    db_spec = vuln.get("database_specific", {})
    severity = db_spec.get("severity", "")
    if severity:
        return severity
    return "UNKNOWN"


def _compute_cvss_score(vuln: dict, severity_str: str) -> float:
    """Ermittelt einen numerischen CVSS-Score.

    Strategie (Priorität):
    1. CVSS v3.x / v4.0 base-score aus severity[].score (numerisch)
    2. Severity-Label aus database_specific.severity → Schätzwert
    3. Fallback 0.0 (UNKNOWN)
    """
    # 1. Numerischen Score aus CVSS-Daten versuchen
    for s in vuln.get("severity", []):
        # Manche APIs liefern 'score' als Zahl direkt
        raw = s.get("score", "")
        if isinstance(raw, (int, float)):
            return float(raw)
        # Oder als String "7.5"
        try:
            return float(raw)
        except (ValueError, TypeError):
            pass

    # 2. Aus CVSS-Vektor via FIRST.org API oder Schätzung über Severity-Label
    db_severity = vuln.get("database_specific", {}).get("severity", "").upper()
    if db_severity in SEVERITY_LABEL_SCORES:
        return SEVERITY_LABEL_SCORES[db_severity]

    # 3. Severity-String prüfen (könnte "HIGH" etc. sein)
    upper = severity_str.upper()
    if upper in SEVERITY_LABEL_SCORES:
        return SEVERITY_LABEL_SCORES[upper]

    return 0.0


def _extract_fixed_version(affected: dict) -> str:
    """Ermittelt die erste fixe Version aus affected-Ranges."""
    for rng in affected.get("ranges", []):
        for event in rng.get("events", []):
            if "fixed" in event:
                return event["fixed"]
    return "–"


def parse_vulnerabilities(
    dep: Dependency, vulns: list[dict]
) -> list[Vulnerability]:
    """Konvertiert rohe OSV-Einträge in Vulnerability-Objekte."""
    results: list[Vulnerability] = []
    for v in vulns:
        vuln_id = v.get("id", "?")
        summary = v.get("summary", v.get("details", "Keine Beschreibung"))
        severity = _extract_severity(v)
        aliases = v.get("aliases", [])

        affected_versions = ""
        fixed_version = "–"
        for aff in v.get("affected", []):
            pkg = aff.get("package", {})
            if pkg.get("name") == dep.name:
                affected_versions = ", ".join(aff.get("versions", [])[:10])
                if len(aff.get("versions", [])) > 10:
                    affected_versions += " …"
                fixed_version = _extract_fixed_version(aff)
                break

        refs = [r.get("url", "") for r in v.get("references", []) if r.get("url")]

        cvss_score = _compute_cvss_score(v, severity)

        results.append(
            Vulnerability(
                vuln_id=vuln_id,
                summary=summary[:300],
                severity=severity,
                cvss_score=cvss_score,
                affected_package=f"{dep.ecosystem}:{dep.name}@{dep.version}",
                affected_versions=affected_versions,
                fixed_version=fixed_version,
                references=refs[:5],
                aliases=aliases,
            )
        )
    return results


# ── Report-Generierung ──────────────────────────────────────────────
def generate_markdown_report(result: ScanResult) -> str:
    """Erzeugt einen Markdown-Report aus dem Scan-Ergebnis."""
    lines: list[str] = []
    lines.append("# CVE-Scan Report – TARATool")
    lines.append("")
    lines.append(f"**Scan-Zeitpunkt:** {result.timestamp}  ")
    lines.append(f"**Repository:** {result.repository}  ")
    lines.append(
        f"**Abhängigkeiten geprüft:** {result.dependencies_scanned}  "
    )
    lines.append(
        f"**Schwachstellen gefunden:** {result.vulnerabilities_found}"
    )
    lines.append("")

    # ── Zusammenfassung ──
    if result.vulnerabilities_found == 0:
        lines.append(
            "> ✅ **Keine bekannten Schwachstellen gefunden.**"
        )
    else:
        lines.append(
            f"> ⚠️ **{result.vulnerabilities_found} Schwachstelle(n) gefunden!**"
        )
    lines.append("")

    # ── Geprüfte Abhängigkeiten ──
    lines.append("## Geprüfte Abhängigkeiten")
    lines.append("")
    lines.append("| Paket | Version | Ökosystem | Quelle |")
    lines.append("|-------|---------|-----------|--------|")
    for d in result.dependencies:
        lines.append(
            f"| {d.name} | {d.version or '–'} | {d.ecosystem} | {d.source} |"
        )
    lines.append("")

    # ── Schwachstellen ──
    if result.vulnerabilities:
        lines.append("## Gefundene Schwachstellen")
        lines.append("")
        for v in result.vulnerabilities:
            cve_aliases = [a for a in v.aliases if a.startswith("CVE-")]
            cve_str = ", ".join(cve_aliases) if cve_aliases else "–"
            lines.append(f"### {v.vuln_id}")
            lines.append("")
            lines.append(f"- **Paket:** {v.affected_package}")
            score_display = f"{v.cvss_score:.1f}" if v.cvss_score > 0 else "–"
            high_marker = " 🔴" if v.cvss_score >= CVSS_HIGH_THRESHOLD else ""
            lines.append(f"- **CVSS-Score:** {score_display}{high_marker}")
            lines.append(f"- **Schweregrad:** {v.severity}")
            lines.append(f"- **CVE:** {cve_str}")
            lines.append(f"- **Beschreibung:** {v.summary}")
            lines.append(f"- **Fix-Version:** {v.fixed_version}")
            if v.references:
                lines.append(f"- **Referenzen:**")
                for ref in v.references:
                    lines.append(f"  - {ref}")
            lines.append("")

    # ── Footer ──
    lines.append("---")
    lines.append(
        "*Automatisch generiert von `security/cve_scanner.py` "
        "via [OSV.dev](https://osv.dev).*"
    )
    lines.append("")

    return "\n".join(lines)


def generate_alert_email_body(result: ScanResult) -> str:
    """Erzeugt den Email-Body für den High-Severity-Alert."""
    high = [v for v in result.vulnerabilities if v.cvss_score >= CVSS_HIGH_THRESHOLD]
    lines: list[str] = []
    lines.append("⚠️ CVE-Alert: Kritische Schwachstellen in TARATool-Abhängigkeiten")
    lines.append("=" * 65)
    lines.append("")
    lines.append(f"Scan-Zeitpunkt: {result.timestamp}")
    lines.append(f"Repository:     {result.repository}")
    lines.append(f"Schwachstellen: {result.vulnerabilities_found} gesamt, {len(high)} mit CVSS >= {CVSS_HIGH_THRESHOLD}")
    lines.append("")
    lines.append("-" * 65)

    for v in high:
        cve_aliases = [a for a in v.aliases if a.startswith("CVE-")]
        cve_str = ", ".join(cve_aliases) if cve_aliases else "–"
        lines.append("")
        lines.append(f"  {v.vuln_id}  (CVSS {v.cvss_score:.1f})")
        lines.append(f"  Paket:       {v.affected_package}")
        lines.append(f"  CVE:         {cve_str}")
        lines.append(f"  Fix-Version: {v.fixed_version}")
        lines.append(f"  {v.summary[:200]}")
        if v.references:
            lines.append(f"  → {v.references[0]}")

    lines.append("")
    lines.append("-" * 65)
    lines.append("Vollständiger Report: security/reports/cve_report.md")
    lines.append("https://github.com/SCHUNK-SE-Co-KG/TARATool/blob/main/security/reports/cve_report.md")
    lines.append("")
    return "\n".join(lines)


def write_alert_output(result: ScanResult, report_dir: Path) -> None:
    """Schreibt Alert-Dateien für GitHub Actions (Email-Trigger)."""
    report_dir.mkdir(parents=True, exist_ok=True)
    alert_flag_path = report_dir / "alert_high_severity.txt"

    if result.high_severity_count > 0:
        email_body = generate_alert_email_body(result)
        alert_flag_path.write_text(email_body, encoding="utf-8")
        print(f"📧 Alert-Datei: {alert_flag_path.relative_to(ROOT_DIR)}")

        # GitHub Actions Output setzen (falls in CI)
        gh_output = os.environ.get("GITHUB_OUTPUT")
        if gh_output:
            with open(gh_output, "a") as f:
                f.write(f"high_severity=true\n")
                f.write(f"high_count={result.high_severity_count}\n")
                f.write(f"alert_subject=⚠️ CVE-Alert: {result.high_severity_count} kritische Schwachstelle(n) in TARATool\n")
    else:
        # Alte Alert-Datei entfernen, falls vorhanden
        if alert_flag_path.exists():
            alert_flag_path.unlink()
        gh_output = os.environ.get("GITHUB_OUTPUT")
        if gh_output:
            with open(gh_output, "a") as f:
                f.write("high_severity=false\n")


def save_reports(result: ScanResult, report_dir: Path) -> tuple[Path, Path]:
    """Speichert JSON- und Markdown-Reports."""
    report_dir.mkdir(parents=True, exist_ok=True)

    json_path = report_dir / "cve_report.json"
    md_path = report_dir / "cve_report.md"

    # JSON
    json_path.write_text(
        json.dumps(asdict(result), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # Markdown
    md_path.write_text(generate_markdown_report(result), encoding="utf-8")

    return json_path, md_path


# ── Hauptlogik ───────────────────────────────────────────────────────
def run_scan() -> ScanResult:
    """Führt den vollständigen CVE-Scan durch."""
    print("🔍 CVE-Scanner gestartet …")
    print(f"   Repository-Root: {ROOT_DIR}")
    print()

    # 1. Abhängigkeiten sammeln
    js_deps = extract_js_dependencies(INDEX_HTML)
    py_deps = extract_python_dependencies(REQUIREMENTS_TXT)
    all_deps = js_deps + py_deps

    print(f"📦 {len(js_deps)} JavaScript-Abhängigkeit(en) erkannt:")
    for d in js_deps:
        print(f"   • {d.name}@{d.version}  ({d.ecosystem})")

    print(f"📦 {len(py_deps)} Python-Abhängigkeit(en) erkannt:")
    for d in py_deps:
        print(f"   • {d.name}>={d.version}  ({d.ecosystem})")
    print()

    # 2. OSV-API abfragen
    print("🌐 Frage OSV-API ab …")
    batch_results = query_osv_batch(all_deps)

    # 2b. Detail-Daten nachladen, wenn Batch nur minimale Infos liefert
    batch_results = enrich_vulnerabilities(batch_results)

    # 3. Ergebnisse auswerten
    all_vulns: list[Vulnerability] = []
    for dep, vulns in zip(all_deps, batch_results):
        parsed = parse_vulnerabilities(dep, vulns)
        if parsed:
            print(f"   ⚠  {dep.name}@{dep.version}: {len(parsed)} Schwachstelle(n)")
        all_vulns.extend(parsed)

    if not all_vulns:
        print("   ✅ Keine Schwachstellen gefunden.")

    high_sev = [v for v in all_vulns if v.cvss_score >= CVSS_HIGH_THRESHOLD]
    if high_sev:
        print(f"   🔴 {len(high_sev)} Schwachstelle(n) mit CVSS ≥ {CVSS_HIGH_THRESHOLD}!")

    result = ScanResult(
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        repository="SCHUNK-SE-Co-KG/TARATool",
        dependencies_scanned=len(all_deps),
        vulnerabilities_found=len(all_vulns),
        high_severity_count=len(high_sev),
        dependencies=all_deps,
        vulnerabilities=all_vulns,
    )

    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CVE-Scanner für TARATool-Abhängigkeiten"
    )
    parser.add_argument(
        "--json-only",
        action="store_true",
        help="Nur JSON auf stdout ausgeben, keine Dateien schreiben",
    )
    args = parser.parse_args()

    result = run_scan()

    if args.json_only:
        print(json.dumps(asdict(result), indent=2, ensure_ascii=False))
        return

    json_path, md_path = save_reports(result, REPORT_DIR)
    print()
    print(f"📄 JSON-Report: {json_path.relative_to(ROOT_DIR)}")
    print(f"📄 Markdown-Report: {md_path.relative_to(ROOT_DIR)}")

    # Alert-Datei für GitHub Actions (Email-Trigger)
    write_alert_output(result, REPORT_DIR)
    print()

    if result.vulnerabilities_found > 0:
        print(
            f"⚠️  {result.vulnerabilities_found} Schwachstelle(n) gefunden! "
            "Details im Report."
        )
        if result.high_severity_count > 0:
            print(
                f"🔴 {result.high_severity_count} davon mit CVSS ≥ {CVSS_HIGH_THRESHOLD} "
                "– Email-Alert wird ausgelöst."
            )
        sys.exit(1)
    else:
        print("✅ Keine bekannten Schwachstellen – alles sicher.")
        sys.exit(0)


if __name__ == "__main__":
    main()
