import json
import os
import sys

files = [
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\grasp_sensor_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\algorithms_learned_grasping_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\algorithms_mrcnn_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\web_user_interface_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\tools_database_explorer_trivy.json",
    r"C:\Users\R011239\Documents\Webapp\grasp-sensor\vulnerability_reports\full_scan\web_backend_hardware_utilization_backend_trivy.json",
]

for fpath in files:
    fname = os.path.basename(fpath)
    repo_name = fname.replace("_trivy.json", "")
    print(f"\n{'='*80}")
    print(f"REPO: {repo_name}")
    print(f"File: {fname}")
    
    if not os.path.exists(fpath):
        print(f"  FILE NOT FOUND!")
        continue
    
    fsize = os.path.getsize(fpath)
    print(f"File size: {fsize / (1024*1024):.2f} MB")
    
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
                # Try to get CVSS score from various locations
                cvss = v.get("CVSS", {})
                if cvss:
                    for source, scores in cvss.items():
                        if "V3Score" in scores:
                            cvss_score = str(scores["V3Score"])
                            break
                        elif "V2Score" in scores:
                            cvss_score = str(scores["V2Score"])
                            break
                
                high_crit_vulns.append({
                    "CVE": v.get("VulnerabilityID", "N/A"),
                    "Severity": sev,
                    "CVSS": cvss_score,
                    "Package": v.get("PkgName", "N/A"),
                    "InstalledVersion": v.get("InstalledVersion", "N/A"),
                    "FixedVersion": v.get("FixedVersion", "N/A"),
                    "Title": v.get("Title", v.get("Description", "N/A"))[:120],
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
    
    print(f"Total vulnerabilities (all severities): {all_vulns_count}")
    print(f"HIGH+CRITICAL (unique CVE+Package): {len(unique_vulns)}")
    print(f"  CRITICAL: {critical_count}")
    print(f"  HIGH: {high_count}")
    print(f"\n{'─'*80}")
    print(f"{'CVE ID':<20} {'Sev':<10} {'CVSS':<6} {'Package':<30} {'Installed':<20} {'Fixed':<20}")
    print(f"{'─'*80}")
    
    # Sort: CRITICAL first, then HIGH, then by CVE
    unique_vulns.sort(key=lambda x: (0 if x["Severity"] == "CRITICAL" else 1, x["CVE"]))
    
    for v in unique_vulns:
        print(f"{v['CVE']:<20} {v['Severity']:<10} {v['CVSS']:<6} {v['Package']:<30} {v['InstalledVersion']:<20} {v['FixedVersion']:<20}")
        if v['Title'] and v['Title'] != 'N/A':
            print(f"  Title: {v['Title']}")
    
    print(f"{'='*80}")

print("\n\nDONE")
