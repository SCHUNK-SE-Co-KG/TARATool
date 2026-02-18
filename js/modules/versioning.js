/**
 * @file        versioning.js
 * @description Version control and analysis history management
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

// Explicit DOM references (robust against implicit window ID globals)
const historyTableBodyEl       = document.getElementById('historyTableBody');
const versionControlModalEl    = document.getElementById('versionControlModal');
const closeVersionControlModalEl = document.getElementById('closeVersionControlModal');
const versionCommentModalEl    = document.getElementById('versionCommentModal');
const closeVersionCommentModalEl = document.getElementById('closeVersionCommentModal');
const versionCommentFormEl     = document.getElementById('versionCommentForm');
const inputVersionCommentEl    = document.getElementById('inputVersionComment');
const currentVersionInModalEl  = document.getElementById('currentVersionInModal');

function renderHistoryTable(analysis) {
    if (!historyTableBodyEl) return;
    historyTableBodyEl.innerHTML = '';

    const currentVersion = (analysis && analysis.metadata) ? analysis.metadata.version : '';
    const history = Array.isArray(analysis.history) ? analysis.history : [];

    // Sorting: newest first (major/minor numerically)
    const sorted = history.slice().sort((a, b) => {
        const [aMajor, aMinor] = String(a.version || '0.0').split('.').map(n => parseInt(n, 10) || 0);
        const [bMajor, bMinor] = String(b.version || '0.0').split('.').map(n => parseInt(n, 10) || 0);
        if (aMajor !== bMajor) return bMajor - aMajor;
        return bMinor - aMinor;
    });

    sorted.forEach(entry => {
        const row = document.createElement('tr');
        const isCurrent = entry.version === currentVersion;
        if (isCurrent) row.classList.add('is-current-version');

        const eVersion = escapeHtml(entry.version || '-');
        const eDate    = escapeHtml(entry.date || '-');
        const eAuthor  = escapeHtml(entry.author || '-');
        const eComment = escapeHtml(entry.comment || '');
        const eAnalysisId = escapeHtml(analysis.id);

        row.innerHTML = `
            <td>${eVersion}</td>
            <td>${eDate}</td>
            <td>${eAuthor}</td>
            <td>${eComment}</td>
            <td>
                <button onclick="revertToVersion('${eAnalysisId}', '${eVersion}')" 
                        class="action-button small" 
                        ${isCurrent ? 'disabled' : ''}>
                    ${isCurrent ? 'Aktuell' : 'Wiederherstellen'}
                </button>
            </td>
        `;
        historyTableBodyEl.appendChild(row);
    });
}

window.revertToVersion = (analysisId, version) => {
    const analysis = analysisData.find(a => a.id === analysisId);
    if (!analysis) return;

    const entry = (analysis.history || []).find(h => h.version === version);
    if (!entry) return;

    if (!entry.state) {
        showToast('Diese Version kann nicht wiederhergestellt werden (kein gespeicherter Zustand).', 'error');
        return;
    }

    showConfirmation({
        title: 'Versionswiederherstellung',
        messageHtml: `Sind Sie sicher, dass Sie zur Version <b>${escapeHtml(version)}</b> (${escapeHtml(entry.comment)}) zurückkehren möchten? Aktuelle Änderungen werden dabei überschrieben.`,
        confirmText: 'Ja, wiederherstellen',
        confirmClass: 'primary-button dangerous',
        onConfirm: () => {
            analysis.name = entry.state.name;
            analysis.description = entry.state.description;
            analysis.intendedUse = entry.state.intendedUse;
            analysis.assets = entry.state.assets;
            
            analysis.damageScenarios = entry.state.damageScenarios;
            analysis.impactMatrix = entry.state.impactMatrix;
            
            analysis.riskEntries = entry.state.riskEntries;

            // Security Objectives
            analysis.securityGoals = entry.state.securityGoals || [];
            analysis.residualRisk = entry.state.residualRisk || { leaves: {}, entries: [], treeNotes: {} };
            if (!analysis.residualRisk.leaves) analysis.residualRisk.leaves = {};
            if (!Array.isArray(analysis.residualRisk.entries)) analysis.residualRisk.entries = [];
            if (!analysis.residualRisk.treeNotes) analysis.residualRisk.treeNotes = {};
            
            analysis.metadata.version = entry.version;
            analysis.metadata.author = entry.state.metadata.author;
            analysis.metadata.date = entry.state.metadata.date;

            fillAnalysisForm(analysis);
            renderHistoryTable(analysis);

            // Re-render active tab using the shared utility
            if (typeof renderActiveTab === 'function') {
                renderActiveTab(analysis);
            }

            saveAnalyses();
            if (versionControlModalEl) versionControlModalEl.style.display = 'none';
            
            showToast(`Erfolgreich zur Version ${version} zurückgekehrt.`, 'success');
            const elSB = document.getElementById('statusBarMessage');
            if (elSB) elSB.textContent = `Version ${version} wiederhergestellt.`;
        }
    });
};


// Open modal for creating a new version
window.openVersionCommentModal = () => {
    if (!activeAnalysisId) return;
    const analysis = getActiveAnalysis();
    if (!analysis) return;

    if (currentVersionInModalEl) {
        currentVersionInModalEl.textContent = analysis.metadata && analysis.metadata.version ? analysis.metadata.version : '-';
    }
    if (inputVersionCommentEl) {
        inputVersionCommentEl.value = '';
        inputVersionCommentEl.focus();
    }

    // Default: incremental
    try {
        const radios = document.querySelectorAll('input[name="versionType"]');
        radios.forEach(r => {
            r.checked = (r.value === 'minor');
        });
    } catch (e) { /* radio elements may not exist */ }

    if (versionCommentModalEl) {
        versionCommentModalEl.style.display = 'block';
    }
};


// Main function for creating a new version (with major/minor selection)
function createNewVersion(comment) {
    if (!activeAnalysisId) return;

    const analysis = getActiveAnalysis();
    if (!analysis) return;

    saveCurrentAnalysisState();
    saveAnalyses(); 

    if (!comment || comment.trim() === "") {
        showToast('Abgebrochen. Versionskommentar ist notwendig.', 'info');
        return;
    }
    
    const versionTypeElement = document.querySelector('input[name="versionType"]:checked');
    const versionType = versionTypeElement ? versionTypeElement.value : 'minor'; 

    // Ensure history array exists
    if (!Array.isArray(analysis.history)) analysis.history = [];

    const existing = new Set(analysis.history.map(h => String(h.version || '').trim()).filter(Boolean));

    const currentVersion = String((analysis.metadata && analysis.metadata.version) ? analysis.metadata.version : '0.0');
    let [major, minor] = currentVersion.split('.').map(n => parseInt(n, 10) || 0);

    // Determine next free version (no duplicates)
    let newVersion = '';
    if (versionType === 'major') {
        let m = major + 1;
        while (existing.has(`${m}.0`)) m++;
        newVersion = `${m}.0`;
    } else {
        let mi = minor + 1;
        while (existing.has(`${major}.${mi}`)) mi++;
        newVersion = `${major}.${mi}`;
    }

    const today = (typeof getTodayISO === 'function') ? getTodayISO() : todayISO;
    const newEntry = {
        version: newVersion,
        author: analysis.metadata.author, 
        date: today,
        comment: comment.trim(), 
        state: {
            name: analysis.name,
            metadata: { ...analysis.metadata, version: newVersion, date: today },
            description: analysis.description,
            intendedUse: analysis.intendedUse,
            assets: JSON.parse(JSON.stringify(analysis.assets)), 
            damageScenarios: JSON.parse(JSON.stringify(analysis.damageScenarios)),
            impactMatrix: JSON.parse(JSON.stringify(analysis.impactMatrix)),
            riskEntries: JSON.parse(JSON.stringify(analysis.riskEntries)),
            securityGoals: JSON.parse(JSON.stringify(analysis.securityGoals || [])),
            residualRisk: JSON.parse(JSON.stringify(analysis.residualRisk || { leaves: {} }))
        }
    };
    
    analysis.history.push(newEntry);
    
    analysis.metadata.version = newVersion;
    analysis.metadata.date = today;
    
    fillAnalysisForm(analysis);
    renderHistoryTable(analysis);
    saveAnalyses();
    showToast(`Neue Version ${newVersion} erstellt.`, 'success');
    const elStatusBar = document.getElementById('statusBarMessage');
    if (elStatusBar) elStatusBar.textContent = `Neue Version ${newVersion} erstellt.`;

    if (versionControlModalEl) versionControlModalEl.style.display = 'none';
}

// Event listeners for modals
if (closeVersionControlModalEl) {
    closeVersionControlModalEl.onclick = () => { if (versionControlModalEl) versionControlModalEl.style.display = 'none'; };
}

if (closeVersionCommentModalEl) {
    closeVersionCommentModalEl.onclick = () => { if (versionCommentModalEl) versionCommentModalEl.style.display = 'none'; };
}

if (versionCommentFormEl) {
    versionCommentFormEl.onsubmit = (e) => {
        e.preventDefault();
        const comment = inputVersionCommentEl ? inputVersionCommentEl.value.trim() : '';
        if (comment) {
            createNewVersion(comment); 
            if (versionCommentModalEl) versionCommentModalEl.style.display = 'none';
        } else {
            showToast('Bitte geben Sie einen Versionskommentar ein.', 'warning');
        }
    };
}