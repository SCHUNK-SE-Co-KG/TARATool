// =============================================================
// --- STORAGE & LOAD FUNCTIONS ---
// =============================================================

function saveAnalyses() {
    try {
        localStorage.setItem('taraAnalyses', JSON.stringify(analysisData));
    } catch (e) {
        showToast('FEHLER: Speichern im Browser-Speicher fehlgeschlagen.', 'error');
        console.error('Speicherfehler:', e);
    }
}

function loadAnalyses() {
    const data = localStorage.getItem('taraAnalyses');
    if (data) {
        analysisData = JSON.parse(data);
        
        // Migration: ensure new fields exist
        analysisData.forEach(analysis => {
            if (!analysis.damageScenarios) {
                analysis.damageScenarios = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS));
            }
            if (!analysis.impactMatrix) {
                analysis.impactMatrix = {};
            }
            if (!analysis.securityGoals) {
                analysis.securityGoals = [];
            }
            if (!analysis.residualRisk) {
                analysis.residualRisk = { leaves: {}, entries: [], treeNotes: {} };
            }
            if (!analysis.residualRisk.leaves) {
                analysis.residualRisk.leaves = {};
            }
            if (!Array.isArray(analysis.residualRisk.entries)) {
                analysis.residualRisk.entries = [];
            }
            if (!analysis.residualRisk.treeNotes) {
                analysis.residualRisk.treeNotes = {};
            }

            // --- Migration: stable Risk-UIDs (so residual risk data is not lost through reindexing)
            if (!analysis.riskEntries) analysis.riskEntries = [];
            analysis.riskEntries.forEach(entry => {
                if (!entry.uid) entry.uid = generateUID('risk');
            });

            // --- Migration: remap old residual risk keys (Prefix = Risk-ID) to UID where possible
            try {
                const leaves = analysis.residualRisk.leaves || {};
                const converted = {};
                Object.keys(leaves).forEach(k => {
                    const parts = String(k).split('|');
                    if (parts.length >= 2) {
                        const prefix = parts[0];
                        const entry = (analysis.riskEntries || []).find(r => r.id === prefix);
                        if (entry && entry.uid) {
                            const rest = k.substring(prefix.length);
                            converted[`${entry.uid}${rest}`] = leaves[k];
                            return;
                        }
                    }
                    converted[k] = leaves[k];
                });
                analysis.residualRisk.leaves = converted;
            } catch (e) {}

            // --- Sync: Risk analysis -> Residual risk structure (entries)
            try {
                if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
                    syncResidualRiskFromRiskAnalysis(analysis, false);
                }
            } catch (e) {}
        });

    } else {
        analysisData = [defaultAnalysis];
    }
}

function saveCurrentAnalysisState() {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    analysis.name = inputAnalysisName.value.trim();
    analysis.description = inputDescription.value.trim();
    analysis.intendedUse = inputIntendedUse.value.trim();
    analysis.metadata.author = inputAuthorName.value.trim(); 
}

// =============================================================
// --- ID / UID HELPERS ---
// =============================================================

// Stable UID generator for internal assignments (e.g., residual risk keys).
// Uses crypto.randomUUID() if available, otherwise falls back.
function generateUID(prefix = 'uid') {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `${prefix}_${crypto.randomUUID()}`;
        }
    } catch (e) {}
    const rand = Math.random().toString(36).slice(2, 10);
    const ts = Date.now().toString(36);
    return `${prefix}_${ts}_${rand}`;
}

// =============================================================
// --- GENERAL FUNCTIONS ---
// =============================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        const parent = toast.parentElement; 
        if (parent && parent.contains(toast)) {
             setTimeout(() => {
                 try {
                     parent.removeChild(toast);
                 } catch (e) {}
             }, 500);
        }
    }, 4000);
}