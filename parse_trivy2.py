import json
import os
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

files = [
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\grasp_sensor_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\algorithms_learned_grasping_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\algorithms_mrcnn_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\web_user_interface_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\tools_database_explorer_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\web_backend_hardware_utilization_backend_trivy.json",
]

output_lines = []

def out(s=""):
    output_lines.append(s)

for fpath in files:
    fname = os.path.basename(fpath)
    repo_name = fname.replace("_trivy.json", "")
    out()
    out("=" * 120)
    out(f"REPO: {repo_name}")
    out(f"File: {fname}")
    
    if not os.path.exists(fpath):
        out("  FILE NOT FOUND!")
        continue
    
    fsize = os.path.getsize(fpath)
    out(f"File size: {fsize / (1024*1024):.2f} MB")
    
    with open(fpath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    results = data.get("Results", [])
    
    high_crit_vulns = []
    all_vulns_count = 0
    
    for result in results:
        target = result.get("Target", "unknown")
        vulns = result.get("Vulnerabilities", [])
        if vulns is None:
            vulns = []
        all_vulns_count += len(vulns)
        for v in vulns:
            sev = v.get("Severity", "UNKNOWN").upper()
            if sev in ("HIGH", "CRITICAL"):
                cvss_score = ""
                cvss = v.get("CVSS", {})
                if cvss:
                    for source, scores in cvss.items():
                        if isinstance(scores, dict):
                            if "V3Score" in scores:
                                cvss_score = str(scores["V3Score"])
                                break
                            elif "V2Score" in scores:
                                cvss_score = str(scores["V2Score"])
                                break
                
                title = v.get("Title", "") or ""
                if not title:
                    title = (v.get("Description", "") or "")[:150]
                else:
                    title = title[:150]
                
                high_crit_vulns.append({
                    "CVE": v.get("VulnerabilityID", "N/A"),
                    "Severity": sev,
                    "CVSS": cvss_score if cvss_score else "N/A",
                    "Package": v.get("PkgName", "N/A"),
                    "InstalledVersion": v.get("InstalledVersion", "N/A"),
                    "FixedVersion": v.get("FixedVersion", "N/A") if v.get("FixedVersion") else "None",
                    "Title": title,
                    "Target": target,
                })
    
    # Deduplicate by CVE+Package
    seen = set()
    unique_vulns = []
    for v in high_crit_vulns:
        key = (v["CVE"], v["Package"])
        if key not in seen:
            seen.add(key)
            unique_vulns.append(v)
    
    critical_count = sum(1 for v in unique_vulns if v["Severity"] == "CRITICAL")
    high_count = sum(1 for v in unique_vulns if v["Severity"] == "HIGH")
    
    out(f"Total vulnerabilities (all severities): {all_vulns_count}")
    out(f"HIGH+CRITICAL unique (CVE+Package): {len(unique_vulns)}")
    out(f"  CRITICAL: {critical_count}")
    out(f"  HIGH: {high_count}")
    out()
    
    # Sort: CRITICAL first, then HIGH, then by CVE
    unique_vulns.sort(key=lambda x: (0 if x["Severity"] == "CRITICAL" else 1, x["CVE"]))
    
    out(f"| {'CVE ID':<22} | {'Severity':<10} | {'CVSS':<6} | {'Package':<35} | {'Installed':<20} | {'Fixed':<25} |")
    out(f"|{'-'*24}|{'-'*12}|{'-'*8}|{'-'*37}|{'-'*22}|{'-'*27}|")
    
    for v in unique_vulns:
        out(f"| {v['CVE']:<22} | {v['Severity']:<10} | {v['CVSS']:<6} | {v['Package']:<35} | {v['InstalledVersion']:<20} | {v['FixedVersion']:<25} |")
        if v['Title']:
            out(f"|   Title: {v['Title']:<111} |")
    
    out("=" * 120)

out()
out("DONE - All reports processed.")

# Write output
with open(r"C:\Users\R011239\Documents\Webapp\TRA\TARATool\trivy_output.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(output_lines))

print("Output written to trivy_output.txt")
