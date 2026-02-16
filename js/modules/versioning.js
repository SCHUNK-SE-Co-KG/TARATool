/**
 * @file        versioning.js
 * @description Version control and analysis history management
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

function renderHistoryTable(analysis) {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';

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

        row.innerHTML = `
            <td>${entry.version || '-'}</td>
            <td>${entry.date || '-'}</td>
            <td>${entry.author || '-'}</td>
            <td>${entry.comment || ''}</td>
            <td>
                <button onclick="revertToVersion('${analysis.id}', '${entry.version}')" 
                        class="action-button small" 
                        ${isCurrent ? 'disabled' : ''}>
                    ${isCurrent ? 'Aktuell' : 'Wiederherstellen'}
                </button>
            </td>
        `;
        historyTableBody.appendChild(row);
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
    
    confirmationTitle.textContent = 'Versionswiederherstellung';
    confirmationMessage.innerHTML = `Sind Sie sicher, dass Sie zur Version <b>${version}</b> (${entry.comment}) zurückkehren möchten? Aktuelle Änderungen werden dabei überschrieben.`;
    
    btnConfirmAction.textContent = 'Ja, wiederherstellen';
    btnConfirmAction.classList.add('dangerous'); 
    
    confirmationModal.style.display = 'block';

    btnConfirmAction.onclick = null; 
    btnCancelConfirmation.onclick = null;
    closeConfirmationModal.onclick = null;
    
    btnConfirmAction.onclick = () => {
        
        analysis.name = entry.state.name;
        analysis.description = entry.state.description;
        analysis.intendedUse = entry.state.intendedUse;
        analysis.assets = entry.state.assets;
        
        analysis.damageScenarios = entry.state.damageScenarios;
        analysis.impactMatrix = entry.state.impactMatrix;
        
        analysis.riskEntries = entry.state.riskEntries;

        // Security Objectives (new)
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
        
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab && activeTab.dataset.tab === 'tabAssets' && typeof renderAssets === 'function') {
            renderAssets(analysis);
        } else if (activeTab && activeTab.dataset.tab === 'tabDamageScenarios' && typeof renderDamageScenarios === 'function' && typeof renderImpactMatrix === 'function') {
            renderDamageScenarios();
            renderImpactMatrix();
        } else if (activeTab && activeTab.dataset.tab === 'tabSecurityGoals' && typeof renderSecurityGoals === 'function') {
            renderSecurityGoals(analysis);
        } else if (activeTab && activeTab.dataset.tab === 'tabRiskAnalysis' && typeof renderRiskAnalysis === 'function') {
            renderRiskAnalysis();
        } else if (activeTab && activeTab.dataset.tab === 'tabResidualRisk' && typeof renderResidualRisk === 'function') {
            renderResidualRisk(analysis);
        }

        saveAnalyses();
        versionControlModal.style.display = 'none';
        confirmationModal.style.display = 'none'; 
        btnConfirmAction.classList.remove('dangerous');
        
        showToast(`Erfolgreich zur Version ${version} zurückgekehrt.`, 'success');
        statusBarMessage.textContent = `Version ${version} wiederhergestellt.`;
    };
    
    btnCancelConfirmation.onclick = () => {
        confirmationModal.style.display = 'none';
        btnConfirmAction.classList.remove('dangerous');
    };
    
    closeConfirmationModal.onclick = () => {
        confirmationModal.style.display = 'none';
        btnConfirmAction.classList.remove('dangerous');
    };
};


// Open modal for creating a new version
window.openVersionCommentModal = () => {
    if (!activeAnalysisId) return;
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    if (typeof currentVersionInModal !== 'undefined' && currentVersionInModal) {
        currentVersionInModal.textContent = analysis.metadata && analysis.metadata.version ? analysis.metadata.version : '-';
    }
    if (typeof inputVersionComment !== 'undefined' && inputVersionComment) {
        inputVersionComment.value = '';
        inputVersionComment.focus();
    }

    // Default: incremental
    try {
        const radios = document.querySelectorAll('input[name="versionType"]');
        radios.forEach(r => {
            r.checked = (r.value === 'minor');
        });
    } catch (e) {}

    if (typeof versionCommentModal !== 'undefined' && versionCommentModal) {
        versionCommentModal.style.display = 'block';
    }
};


// Main function for creating a new version (with major/minor selection)
function createNewVersion(comment) {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    saveCurrentAnalysisState();
    saveAnalyses(); 

    if (!comment || comment.trim() === "") {
        showToast('Abgebrochen. Versionskommentar ist notwendig.', 'info');
        return;
    }
    
    const versionTypeElement = document.querySelector('input[name="versionType"]:checked');
    const versionType = versionTypeElement ? versionTypeElement.value : 'minor'; 

    const existing = new Set((analysis.history || []).map(h => String(h.version || '').trim()).filter(Boolean));

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

    const newEntry = {
        version: newVersion,
        author: analysis.metadata.author, 
        date: todayISO,
        comment: comment.trim(), 
        state: {
            name: analysis.name,
            metadata: { ...analysis.metadata, version: newVersion, date: todayISO },
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
    analysis.metadata.date = todayISO;
    
    fillAnalysisForm(analysis);
    renderHistoryTable(analysis);
    saveAnalyses();
    showToast(`Neue Version ${newVersion} erstellt.`, 'success');
    statusBarMessage.textContent = `Neue Version ${newVersion} erstellt.`;

    if (versionControlModal) versionControlModal.style.display = 'none';
}

// Event listeners for modals
if (closeVersionControlModal) {
    closeVersionControlModal.onclick = () => versionControlModal.style.display = 'none';
}

if (closeVersionCommentModal) {
    closeVersionCommentModal.onclick = () => versionCommentModal.style.display = 'none';
}

if (versionCommentForm) {
    versionCommentForm.onsubmit = (e) => {
        e.preventDefault();
        const comment = inputVersionComment.value.trim();
        if (comment) {
            createNewVersion(comment); 
            versionCommentModal.style.display = 'none';
        } else {
            showToast('Bitte geben Sie einen Versionskommentar ein.', 'warning');
        }
    };
}