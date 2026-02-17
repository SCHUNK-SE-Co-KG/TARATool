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

// =============================================================
// --- HTML ESCAPING ---
// =============================================================

/**
 * Escapes HTML special characters to prevent XSS.
 * Use in all innerHTML/template literal insertions of user data.
 * @param {*} str - Value to escape
 * @returns {string}
 */
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// =============================================================
// --- RISK CLASSIFICATION ---
// =============================================================

/**
 * Returns risk metadata (color, label, display) for a given risk value.
 * Uses the global RISK_THRESHOLDS constant – single source of truth.
 * @param {*} rootRiskValue - The numeric risk score (string or number)
 * @returns {{ color: string, label: string, display: string, colorRGB: number[] }}
 */
function getRiskMeta(rootRiskValue) {
    const rVal = parseFloat(rootRiskValue);
    let match = RISK_UNKNOWN;

    if (!isNaN(rVal)) {
        for (const t of RISK_THRESHOLDS) {
            if (rVal >= t.min) { match = t; break; }
        }
    }

    const display = (rootRiskValue === undefined || rootRiskValue === null || String(rootRiskValue).trim() === '')
        ? '-' : String(rootRiskValue);

    return { color: match.color, label: match.label, display, colorRGB: match.colorRGB };
}

// =============================================================
// --- CONFIRMATION MODAL UTILITY ---
// =============================================================

/**
 * Opens the shared confirmation modal with the given options.
 * Eliminates duplicated modal-wiring boilerplate across modules.
 * @param {object} opts
 * @param {string} opts.title       - Modal heading
 * @param {string} opts.messageHtml - Inner HTML for the message paragraph
 * @param {string} [opts.confirmText='Löschen'] - Button label
 * @param {string} [opts.confirmClass='primary-button dangerous'] - CSS class(es)
 * @param {function} opts.onConfirm - Callback executed on confirmation
 */
function showConfirmation({ title, messageHtml, confirmText = 'Löschen', confirmClass = 'primary-button dangerous', onConfirm }) {
    const modal     = document.getElementById('confirmationModal');
    const titleEl   = document.getElementById('confirmationTitle');
    const msgEl     = document.getElementById('confirmationMessage');
    const btnOk     = document.getElementById('btnConfirmAction');
    const btnCancel = document.getElementById('btnCancelConfirmation');
    const btnClose  = document.getElementById('closeConfirmationModal');

    if (!modal || !msgEl || !btnOk) return;

    if (titleEl) titleEl.textContent = title || 'Bestätigung';
    msgEl.innerHTML = messageHtml || '';
    btnOk.textContent = confirmText;
    btnOk.className = confirmClass;

    modal.style.display = 'block';

    // Clear previous handlers
    btnOk.onclick = null;
    if (btnCancel) btnCancel.onclick = null;
    if (btnClose) btnClose.onclick = null;

    const closeFn = () => {
        modal.style.display = 'none';
        btnOk.className = 'primary-button'; // reset class
    };

    btnOk.onclick = () => {
        if (typeof onConfirm === 'function') onConfirm();
        closeFn();
    };
    if (btnCancel) btnCancel.onclick = closeFn;
    if (btnClose) btnClose.onclick = closeFn;
}

// =============================================================
// --- TOAST NOTIFICATIONS ---
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