/**
 * @file        utils.js
 * @description Storage, persistence, data migration, and general utility functions
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

function saveAnalyses() {
    try {
        localStorage.setItem('taraAnalyses', JSON.stringify(analysisData));
    } catch (e) {
        console.error('Speicherfehler:', e);
        if (typeof showToast === 'function') {
            showToast('FEHLER: Speichern im Browser-Speicher fehlgeschlagen.', 'error');
        }
    }
}

// =============================================================
// --- DATA MIGRATION (shared between load & import) ---
// =============================================================

/**
 * Ensures all required fields exist on an analysis object and performs
 * data migrations (risk UIDs, residual risk key remapping, sync).
 * Called from loadAnalyses() and executeImport() – single source of truth.
 * @param {object} analysis - The analysis object to migrate/validate
 */
function migrateAnalysis(analysis) {
    if (!analysis) return;

    // Ensure required array/object fields
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

    // Migration: stable Risk-UIDs (so residual risk data is not lost through reindexing)
    if (!analysis.riskEntries) analysis.riskEntries = [];
    analysis.riskEntries.forEach(entry => {
        if (entry && !entry.uid) entry.uid = generateUID('risk');
    });

    // Migration: remap old residual risk keys (Prefix = Risk-ID) to UID where possible
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
    } catch (e) {
        console.warn('[Migration] Residual risk key remapping failed:', e);
    }

    // Sync: Risk analysis -> Residual risk structure (entries)
    try {
        if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
            syncResidualRiskFromRiskAnalysis(analysis, false);
        }
    } catch (e) {
        console.warn('[Migration] Residual risk sync failed:', e);
    }
}

function loadAnalyses() {
    const data = localStorage.getItem('taraAnalyses');
    if (data) {
        try {
            analysisData = JSON.parse(data);
        } catch (e) {
            console.error('[loadAnalyses] Corrupt localStorage data:', e);
            showToast('FEHLER: Gespeicherte Daten sind beschädigt. Neue Analyse wird erstellt.', 'error');
            analysisData = [createDefaultAnalysis()];
            return;
        }

        // Validate basic structure
        if (!Array.isArray(analysisData)) {
            console.warn('[loadAnalyses] analysisData is not an array, resetting.');
            analysisData = [createDefaultAnalysis()];
            return;
        }

        // Migrate each analysis
        analysisData.forEach(analysis => migrateAnalysis(analysis));

    } else {
        analysisData = [createDefaultAnalysis()];
    }
}

function saveCurrentAnalysisState() {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const elName = document.getElementById('inputAnalysisName');
    const elDesc = document.getElementById('inputDescription');
    const elUse  = document.getElementById('inputIntendedUse');
    const elAuth = document.getElementById('inputAuthorName');

    if (elName) analysis.name = elName.value.trim();
    if (elDesc) analysis.description = elDesc.value.trim();
    if (elUse)  analysis.intendedUse = elUse.value.trim();
    if (elAuth) analysis.metadata.author = elAuth.value.trim();
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
    } catch (e) {
        console.warn('[generateUID] crypto.randomUUID() failed, using fallback:', e);
    }
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

    // Trigger show transition
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        // Wait for CSS transition to finish before removing from DOM
        toast.addEventListener('transitionend', () => {
            try {
                if (toast.parentElement) toast.parentElement.removeChild(toast);
            } catch (e) { /* already removed */ }
        }, { once: true });
        // Fallback removal if transitionend doesn't fire
        setTimeout(() => {
            try {
                if (toast.parentElement) toast.parentElement.removeChild(toast);
            } catch (e) { /* already removed */ }
        }, 600);
    }, 4000);
}