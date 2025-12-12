// =============================================================
// --- VERSIONSKONTROLLE LOGIK ---
// =============================================================

function renderHistoryTable(analysis) {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';

    const currentVersion = analysis.metadata.version;
    const history = analysis.history;
    
    // Sortierung der Historie
    history.sort((a, b) => {
        const [aMajor, aMinor] = a.version.split('.').map(Number);
        const [bMajor, bMinor] = b.version.split('.').map(Number);
        if (aMajor !== bMajor) return aMajor - bMajor;
        return aMinor - bMinor;
    });

    const currentVersionIndex = history.findIndex(entry => entry.version === currentVersion);
    
    let tempMinorVersions = []; 
    let finalBaseline = null;
    
    for (let i = currentVersionIndex - 1; i >= 0; i--) {
        const entry = history[i];
        
        const isX0Baseline = entry.version.endsWith('.0') && entry.version !== INITIAL_VERSION;

        if (isX0Baseline) {
            finalBaseline = entry.version;
            tempMinorVersions = []; 
            break; 
        }
        
        if (tempMinorVersions.length < 3) {
            tempMinorVersions.push(entry.version);
        } else {
            break; 
        }
    }
    
    const restorable = new Set();
    
    if (finalBaseline) {
        restorable.add(finalBaseline);
    } else {
        tempMinorVersions.forEach(v => restorable.add(v));
    }
    
    const versionsToRender = new Set([...restorable, currentVersion]);
    
    history
        .filter(entry => versionsToRender.has(entry.version))
        .sort((a, b) => {
            if (a.version === currentVersion) return -1;
            if (b.version === currentVersion) return 1;
            
            const [aMajor, aMinor] = a.version.split('.').map(Number);
            const [bMajor, bMinor] = b.version.split('.').map(Number);
            if (aMajor !== bMajor) return bMajor - aMajor;
            return bMinor - aMinor;
        })
        .forEach(entry => {
            const row = document.createElement('tr');
            const isCurrent = entry.version === currentVersion;
            
            if (isCurrent) {
                row.classList.add('is-current-version');
            }

            const isActiveRollbackButton = !isCurrent && restorable.has(entry.version);
            
            row.innerHTML = `
                <td>${entry.version}</td>
                <td>${entry.author}</td>
                <td>${entry.date}</td>
                <td>${entry.comment}</td>
                <td>
                    <button onclick="revertToVersion('${analysis.id}', '${entry.version}')" 
                            class="action-button small" 
                            ${!isActiveRollbackButton ? 'disabled' : ''}>
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

    const entry = analysis.history.find(h => h.version === version);
    if (!entry) return;
    
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
        } else if (activeTab && activeTab.dataset.tab === 'tabRiskAnalysis' && typeof renderRiskAnalysis === 'function') {
            renderRiskAnalysis();
        }

        saveAnalyses();
        versionControlModal.style.display = 'none';
        confirmationModal.style.display = 'none'; 
        
        showToast(`Erfolgreich zur Version ${version} zurückgekehrt.`, 'success');
        statusBarMessage.textContent = `Version ${version} wiederhergestellt.`;
    };
    
    btnCancelConfirmation.onclick = () => {
        confirmationModal.style.display = 'none';
    };
    
    closeConfirmationModal.onclick = () => {
        confirmationModal.style.display = 'none';
    };
};


// Die Hauptfunktion zum Erstellen einer neuen Version (mit Major/Minor Auswahl)
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

    const currentVersion = analysis.metadata.version;
    let [major, minor] = currentVersion.split('.').map(Number);
    let newVersion;
    
    if (versionType === 'major') {
        major++;
        minor = 0; 
        newVersion = `${major}.0`; 
    } else { // 'minor'
        minor++;
        newVersion = `${major}.${minor}`;
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
            riskEntries: JSON.parse(JSON.stringify(analysis.riskEntries)) 
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

// Event Listener für Modals
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