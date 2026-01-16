// =============================================================
// --- SPEICHER & LADEFUNKTIONEN ---
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
        
        // Migration/Sicherstellung neuer Felder
        analysisData.forEach(analysis => {
            if (!analysis.damageScenarios) {
                analysis.damageScenarios = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS));
            }
            if (!analysis.impactMatrix) {
                analysis.impactMatrix = {};
            }
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
// --- ALLGEMEINE FUNKTIONEN ---
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