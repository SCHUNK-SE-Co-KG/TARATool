
// =============================================================
// --- ANALYSE VERWALTUNG (SWITCH, CREATE, IMPORT, EXPORT) ---
// =============================================================

function activateAnalysis(id) {
    const analysis = analysisData.find(a => a.id === id);
    if (!analysis) return;
    
    activeAnalysisId = id;
    
    // UI Update
    fillAnalysisForm(analysis);
    
    // Status Bar Update
    if (statusBarMessage) {
        statusBarMessage.textContent = `Aktiv: ${analysis.name} (v${analysis.metadata.version})`;
    }
    
    // Dropdown Sync
    if (analysisSelector) analysisSelector.value = id;

    // Aktiven Tab neu rendern
    const activeTabBtn = document.querySelector('.tab-button.active');
    if (activeTabBtn) {
        const tabId = activeTabBtn.dataset.tab;
        
        if (tabId === 'tabOverview') {
            renderOverview(analysis);
        }
        else if (tabId === 'tabAssets' && typeof renderAssets === 'function') {
            renderAssets(analysis);
        }
        else if (tabId === 'tabDamageScenarios') {
            if (typeof renderDamageScenarios === 'function') renderDamageScenarios();
            if (typeof renderImpactMatrix === 'function') renderImpactMatrix();
        }
        else if (tabId === 'tabRiskAnalysis') {
            if (typeof renderRiskAnalysis === 'function') renderRiskAnalysis();
        }
    }
}

// =============================================================
// --- UI UPDATES & ALLGEMEINE FUNKTIONEN ---
// =============================================================

function renderAnalysisSelector() {
    if (!analysisSelector) return;
    analysisSelector.innerHTML = '';
    
    if (analysisData.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'Keine Analysen vorhanden';
        option.value = '';
        analysisSelector.appendChild(option);
        return;
    }

    analysisData.forEach(analysis => {
        const option = document.createElement('option');
        option.textContent = analysis.name;
        option.value = analysis.id;
        if (analysis.id === activeAnalysisId) {
            option.selected = true;
        }
        analysisSelector.appendChild(option);
    });
}

function fillAnalysisForm(analysis) {
    if (analysisNameDisplay) analysisNameDisplay.textContent = analysis.name;
    if (inputAnalysisName) inputAnalysisName.value = analysis.name;
    if (inputDescription) inputDescription.value = analysis.description;
    if (inputIntendedUse) inputIntendedUse.value = analysis.intendedUse;
    if (inputAuthorName) inputAuthorName.value = analysis.metadata.author; 
    
    if (analysisMetadata) {
        analysisMetadata.innerHTML = `
            <span>Version: ${analysis.metadata.version}</span> | 
            <span>Autor: ${analysis.metadata.author}</span> | 
            <span>Datum: ${analysis.metadata.date}</span>
        `;
    }
    
    // Auch Übersicht aktualisieren, wenn gerade sichtbar
    renderOverview(analysis);
}

// NEU: Erweiterte Funktion für die Übersicht (Dashboard)
function renderOverview(analysis) {
    if (!analysis) return;

    // 1. Einfache Zähler
    const elAssetCount = document.getElementById('statAssetCount');
    const elDSCount = document.getElementById('statDSCount');
    const elRiskCount = document.getElementById('statRiskCount');

    if (elAssetCount) elAssetCount.textContent = (analysis.assets || []).length;
    if (elDSCount) elDSCount.textContent = (analysis.damageScenarios || []).length;
    
    const risks = analysis.riskEntries || [];
    if (elRiskCount) elRiskCount.textContent = risks.length;

    // 2. Detaillierte Risiko-Kategorisierung
    let cCrit = 0;   // >= 2.0
    let cHigh = 0;   // >= 1.6
    let cMed = 0;    // >= 0.8
    let cLow = 0;    // < 0.8

    risks.forEach(r => {
        const val = parseFloat(r.rootRiskValue);
        if (isNaN(val)) return;

        if (val >= 2.0) {
            cCrit++;
        } else if (val >= 1.6) {
            cHigh++;
        } else if (val >= 0.8) {
            cMed++;
        } else {
            cLow++;
        }
    });

    // Werte in die neuen Felder schreiben
    const elCrit = document.getElementById('statCrit');
    const elHigh = document.getElementById('statHigh');
    const elMed = document.getElementById('statMed');
    const elLow = document.getElementById('statLow');

    if (elCrit) elCrit.textContent = cCrit;
    if (elHigh) elHigh.textContent = cHigh;
    if (elMed) elMed.textContent = cMed;
    if (elLow) elLow.textContent = cLow;
}


// =============================================================
// --- IMPORT / EXPORT LOGIK ---
// =============================================================

function exportAnalysis() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) {
        showToast('Keine aktive Analyse zum Exportieren.', 'warning');
        return;
    }
    
    const dataStr = JSON.stringify(analysis, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const safeName = analysis.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    a.download = `TARA_Export_${safeName}_${analysis.metadata.date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Analyse exportiert.', 'success');
}

if (closeImportAnalysisModal) {
    closeImportAnalysisModal.onclick = () => {
        if (importAnalysisModal) importAnalysisModal.style.display = 'none';
    };
}

function executeImport() {
    const file = importFileInput.files[0];
    if (!file) {
        showToast('Bitte eine Datei auswählen.', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (json.id && json.metadata) {
                if (analysisData.some(a => a.id === json.id)) {
                    json.id = json.id + '_imp_' + Date.now();
                    json.name = json.name + ' (Imported)';
                }
                
                analysisData.push(json);
                saveAnalyses();
                renderAnalysisSelector();
                activateAnalysis(json.id);
                
                importAnalysisModal.style.display = 'none';
                showToast(`Analyse "${json.name}" erfolgreich importiert.`, 'success');
            } else {
                showToast('Importfehler: Ungültige Datenstruktur.', 'error');
            }
        } catch (error) {
            console.error('Importfehler:', error);
            showToast('Importfehler: Ungültiges JSON.', 'error');
        }
    };
    reader.readAsText(file);
}

// =============================================================
// --- NEUE ANALYSE LOGIK ---
// =============================================================

/**
 * Initialisiert den "Neue Analyse"-Dialog (Reset/Populate der Kopierauswahl).
 * Wird beim Öffnen und beim Schließen des Modals verwendet.
 */
function prepareNewAnalysisModal() {
    const group = document.getElementById('copyExistingAnalysisGroup');
    const select = document.getElementById('copyExistingAnalysisSelect');
    const btn = document.getElementById('btnToggleCopyExistingAnalysis');

    if (group) group.style.display = 'none';
    if (btn) btn.textContent = 'Kopieren';

    if (!select) return;

    // Optionen neu aufbauen (aktuelle Liste der Analysen)
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Bitte Vorlage wählen…';
    select.appendChild(placeholder);

    (analysisData || []).forEach(a => {
        // Nur valide Analysen
        if (!a || !a.id) return;
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name || a.id;
        select.appendChild(opt);
    });
}

function toggleCopyExistingAnalysisUI() {
    const group = document.getElementById('copyExistingAnalysisGroup');
    const btn = document.getElementById('btnToggleCopyExistingAnalysis');
    const select = document.getElementById('copyExistingAnalysisSelect');
    if (!group) return;

    const willShow = group.style.display === 'none' || group.style.display === '';
    group.style.display = willShow ? 'block' : 'none';

    if (btn) btn.textContent = willShow ? 'Kopieren ausblenden' : 'Kopieren';
    if (willShow) {
        // Beim ersten Öffnen sicherstellen, dass Optionen aktuell sind
        prepareNewAnalysisModal();
        // Danach wieder sichtbar machen (prepareNewAnalysisModal blendet aus)
        group.style.display = 'block';
        if (btn) btn.textContent = 'Kopieren ausblenden';
        if (select) select.focus();
    } else {
        if (select) select.value = '';
    }
}

function createNewAnalysis(e) {
    e.preventDefault();
    
    // Explizite Auswahl der Elemente zur Sicherheit
    const nameInput = document.getElementById('newAnalysisName');
    const modal = document.getElementById('newAnalysisModal');
    
    const newName = nameInput.value.trim();
    if (!newName) return;

    // Eindeutige ID generieren
    const newId = 'tara-' + (analysisData.length + 1).toString().padStart(3, '0') + '-' + Date.now().toString().slice(-4);
    
    // Optional: aus bestehender Analyse kopieren
    const copyGroup = document.getElementById('copyExistingAnalysisGroup');
    const copySelect = document.getElementById('copyExistingAnalysisSelect');
    const copySourceId = (copyGroup && copyGroup.style.display !== 'none' && copySelect) ? (copySelect.value || '') : '';

    let newAnalysis;
    let copySourceName = '';

    if (copySourceId) {
        const source = analysisData.find(a => a.id === copySourceId);
        if (source) {
            copySourceName = source.name || source.id;
            newAnalysis = JSON.parse(JSON.stringify(source));
        }
    }

    // Fallback: Standardstruktur
    if (!newAnalysis) {
        newAnalysis = JSON.parse(JSON.stringify(defaultAnalysis));
    }
    newAnalysis.id = newId;
    newAnalysis.name = newName;
    // Metadaten/History für neue Analyse zurücksetzen
    if (!newAnalysis.metadata) newAnalysis.metadata = { version: INITIAL_VERSION, author: 'Unbekannt', date: todayISO };
    newAnalysis.metadata.version = INITIAL_VERSION;
    newAnalysis.metadata.date = todayISO;

    // History initialisieren (keine Übernahme der alten Historie)
    newAnalysis.history = [
        {
            version: INITIAL_VERSION,
            date: todayISO,
            author: (newAnalysis.metadata && newAnalysis.metadata.author) ? newAnalysis.metadata.author : 'System',
            comment: copySourceName ? `Kopie von: ${copySourceName}` : 'Initiale Erstellung',
            state: {
                name: newName,
                metadata: { ...(newAnalysis.metadata || {}), version: INITIAL_VERSION, date: todayISO },
                description: newAnalysis.description || '',
                intendedUse: newAnalysis.intendedUse || '',
                assets: JSON.parse(JSON.stringify(newAnalysis.assets || [])),
                damageScenarios: JSON.parse(JSON.stringify(newAnalysis.damageScenarios || JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS)))),
                impactMatrix: JSON.parse(JSON.stringify(newAnalysis.impactMatrix || {})),
                riskEntries: JSON.parse(JSON.stringify(newAnalysis.riskEntries || []))
            }
        }
    ];
    
    // Name in der initialen Historie konsistent halten
    if (newAnalysis.history && newAnalysis.history[0] && newAnalysis.history[0].state) {
        newAnalysis.history[0].state.name = newName;
    }
    
    // Daten speichern und UI aktualisieren
    analysisData.push(newAnalysis);
    renderAnalysisSelector();
    activateAnalysis(newId);
    saveAnalyses();
    
    // Modal schließen und Feedback geben
    if (modal) modal.style.display = 'none';
    showToast(`Analyse "${newName}" wurde erstellt.`, 'success');
}

// Event-Listener neu binden
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('newAnalysisForm');
    const modal = document.getElementById('newAnalysisModal');
    const closeBtn = document.getElementById('closeNewAnalysisModal');
    const btnToggleCopy = document.getElementById('btnToggleCopyExistingAnalysis');

    // Submit-Handler (Erstellen)
    if (form) {
        form.onsubmit = createNewAnalysis;
    }

    // X-Button schließen (Bugfix: zuvor fehlender Handler)
    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            if (form) form.reset();
            prepareNewAnalysisModal();
        };
    }

    // Klick auf den dunklen Hintergrund schließt ebenfalls
    if (modal) {
        window.addEventListener('click', (ev) => {
            if (ev.target === modal) {
                modal.style.display = 'none';
                if (form) form.reset();
                prepareNewAnalysisModal();
            }
        });
    }

    // Kopieren-UI
    if (btnToggleCopy) {
        btnToggleCopy.onclick = () => {
            toggleCopyExistingAnalysisUI();
        };
    }

    // Initialer Reset
    prepareNewAnalysisModal();
});

/**
 * Löscht die aktuell aktive Analyse nach Bestätigung durch den Benutzer.
 */
function deleteActiveAnalysis() {
    if (!activeAnalysisId) return;
    
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    // Vorhandenes Bestätigungs-Modal nutzen
    const modal = document.getElementById('confirmationModal');
    const title = document.getElementById('confirmationTitle');
    const msg = document.getElementById('confirmationMessage');
    const btnConfirm = document.getElementById('btnConfirmAction');
    const btnCancel = document.getElementById('btnCancelConfirmation');
    const btnClose = document.getElementById('closeConfirmationModal');

    if (title) title.textContent = 'Gesamte Analyse löschen';
    if (msg) msg.innerHTML = `Sind Sie sicher, dass Sie die Analyse <strong>${analysis.name}</strong> unwiderruflich löschen möchten? <br><br><span style="color:red;">Warnung: Alle Assets, Schadensszenarien und Angriffsbäume gehen verloren!</span>`;
    
    // Buttonzustand zurücksetzen (wichtig, da das Bestätigungs-Modal für mehrere Aktionen genutzt wird)
    if (btnConfirm) {
        btnConfirm.className = 'primary-button';
        btnConfirm.classList.add('dangerous');
        btnConfirm.textContent = 'Ja, alles löschen';
    }
    
    modal.style.display = 'block';

    // Vorherige Handler entfernen, damit es keine Überschneidungen mit anderen Bestätigungen gibt
    if (btnConfirm) btnConfirm.onclick = null;
    if (btnCancel) btnCancel.onclick = null;
    if (btnClose) btnClose.onclick = null;

    // Event-Handler für Bestätigung
    if (btnConfirm) btnConfirm.onclick = () => {
        // Aus der Liste entfernen
        analysisData = analysisData.filter(a => a.id !== activeAnalysisId);
        
        // Falls keine Analysen mehr übrig sind, leere Standard-Analyse erstellen
        if (analysisData.length === 0) {
            analysisData = [JSON.parse(JSON.stringify(defaultAnalysis))];
        }
        
        // Die nächste verfügbare Analyse wählen (die erste in der Liste)
        const nextId = analysisData[0].id;
        
        // Speichern und UI aktualisieren
        saveAnalyses();
        renderAnalysisSelector();
        activateAnalysis(nextId);
        
        modal.style.display = 'none';
        showToast('Analyse wurde erfolgreich gelöscht.', 'success');
    };

    // Abbrechen
    if (btnCancel) btnCancel.onclick = () => {
        modal.style.display = 'none';
    };

    if (btnClose) btnClose.onclick = () => {
        modal.style.display = 'none';
    };
}
