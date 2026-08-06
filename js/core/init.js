/**
 * @file        init.js
 * @description Application initialization and DOM event listener setup.
 *              Single, consolidated DOMContentLoaded handler for the entire core.
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

document.addEventListener('DOMContentLoaded', () => {
  // Theme + language (sliders)
  if (typeof TaraPrefs !== 'undefined' && TaraPrefs.applyPrefsOnLoad) {
    TaraPrefs.applyPrefsOnLoad();
  }
  const swTheme = document.getElementById('toggleTheme');
  if (swTheme && typeof TaraPrefs !== 'undefined') {
    swTheme.addEventListener('change', () =>
      TaraPrefs.setTheme(swTheme.checked ? 'light' : 'dark')
    );
  }
  const swLang = document.getElementById('toggleLang');
  if (swLang && typeof TaraPrefs !== 'undefined') {
    swLang.addEventListener('change', () => TaraPrefs.setLang(swLang.checked ? 'de' : 'en'));
  }
  window.onTaraLangChanged = function () {
    const analysis = typeof getActiveAnalysis === 'function' ? getActiveAnalysis() : null;
    const activeTab = document.querySelector('.tab-button.active')?.dataset?.tab || 'tabOverview';
    if (analysis) {
      if (typeof fillAnalysisForm === 'function') fillAnalysisForm(analysis);
      if (typeof renderActiveTab === 'function') renderActiveTab(analysis, activeTab);
    } else {
      const nameEl = document.getElementById('analysisNameDisplay');
      if (nameEl)
        nameEl.textContent =
          typeof t === 'function' ? t('header.pickAnalysis') : 'Analyse wählen oder neu starten';
      const statusEl = document.getElementById('statusBarMessage');
      if (statusEl)
        statusEl.textContent =
          typeof t === 'function' ? t('status.start') : 'Bitte starten Sie eine neue Analyse.';
    }
    const atModal = document.getElementById('attackTreeModal');
    if (
      atModal &&
      atModal.style.display === 'block' &&
      window.atV2 &&
      typeof window.atV2.reloadLocalizedInputs === 'function'
    ) {
      window.atV2.reloadLocalizedInputs();
    }
    // Restrisiko-Modal: Labels/Dropdowns neu (Werte bereits persistiert)
    const rrModal = document.getElementById('residualRiskModal');
    if (
      rrModal &&
      rrModal.style.display === 'block' &&
      rrModal.dataset.rrEditingUid &&
      typeof window.editResidualRiskTree === 'function'
    ) {
      window.editResidualRiskTree(rrModal.dataset.rrEditingUid);
    }
    // Asset-/DS-Modal: Felder + DE-Hinweise neu laden
    const assetModal = document.getElementById('assetModal');
    if (assetModal && assetModal.style.display === 'block') {
      const id = document.getElementById('assetIdField')?.value;
      if (id && typeof window.editAsset === 'function') window.editAsset(id);
    }
    const dsModal = document.getElementById('damageScenarioModal');
    if (dsModal && dsModal.style.display === 'block') {
      const id = document.getElementById('dsIdField')?.value;
      if (id && typeof window.editDamageScenario === 'function') window.editDamageScenario(id);
    }
    const sgModal = document.getElementById('securityGoalModal');
    if (sgModal && sgModal.style.display === 'block') {
      const id = sgModal.dataset.sgId;
      if (id && typeof window.editSecurityGoal === 'function') window.editSecurityGoal(id);
    }
    const impactModal = document.getElementById('impactCommentModal');
    if (impactModal && impactModal.style.display === 'block') {
      const assetId = document.getElementById('impactCommentAssetId')?.value;
      const dsId = document.getElementById('impactCommentDsId')?.value;
      if (assetId && dsId && typeof window.openImpactComment === 'function')
        window.openImpactComment(assetId, dsId);
    }
    const versionModal = document.getElementById('versionControlModal');
    if (
      versionModal &&
      versionModal.style.display === 'block' &&
      analysis &&
      typeof renderHistoryTable === 'function'
    ) {
      renderHistoryTable(analysis);
    }
    const aboutModal = document.getElementById('aboutModal');
    if (
      aboutModal &&
      aboutModal.style.display === 'block' &&
      typeof openAboutModal === 'function'
    ) {
      openAboutModal();
    }
  };

  window.beforeTaraLangChange = function (fromLang) {
    if (window.atV2 && typeof window.atV2.flushLocalizedInputs === 'function') {
      const atModal = document.getElementById('attackTreeModal');
      if (atModal && atModal.style.display === 'block') {
        window.atV2.flushLocalizedInputs(fromLang);
      }
    }
    // Offene Asset-/DS-Formulare in aktuelle Sprache speichern, bevor Umschalten
    const assetModal = document.getElementById('assetModal');
    if (
      assetModal &&
      assetModal.style.display === 'block' &&
      typeof window.flushAssetModalLang === 'function'
    ) {
      window.flushAssetModalLang(fromLang);
    }
    const dsModal = document.getElementById('damageScenarioModal');
    if (
      dsModal &&
      dsModal.style.display === 'block' &&
      typeof window.flushDsModalLang === 'function'
    ) {
      window.flushDsModalLang(fromLang);
    }
  };

  // Refresh todayISO so it's current even if the page was loaded yesterday
  todayISO = getTodayISO();

  // 1. Initialization
  if (typeof loadAnalyses === 'function') loadAnalyses();
  if (typeof renderAnalysisSelector === 'function') renderAnalysisSelector();

  if (analysisData.length > 0) {
    const firstId = analysisData[0].id;
    if (typeof activateAnalysis === 'function') activateAnalysis(firstId);
  } else {
    if (typeof fillAnalysisForm === 'function') fillAnalysisForm(createDefaultAnalysis());
    const elStatus = document.getElementById('statusBarMessage');
    if (elStatus)
      elStatus.textContent =
        typeof t === 'function' ? t('status.start') : 'Bitte starten Sie eine neue Analyse.';
  }

  // 2. Listener for the analysis selector
  const elSelector = document.getElementById('analysisSelector');
  if (elSelector) {
    elSelector.addEventListener('change', (e) => {
      if (typeof activateAnalysis === 'function') activateAnalysis(e.target.value);
    });
  }

  // 3. Listener for metadata changes (auto-save)
  const metaInputs = document.querySelectorAll(
    '#inputAnalysisName, #inputAuthorName, #inputDescription, #inputIntendedUse'
  );
  metaInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (typeof saveCurrentAnalysisState === 'function') saveCurrentAnalysisState();

      // If name/author changed, update header & list
      if (input.id === 'inputAnalysisName' || input.id === 'inputAuthorName') {
        const analysis = getActiveAnalysis();
        if (analysis) {
          fillAnalysisForm(analysis);
          renderAnalysisSelector();
        }
      }
    });
  });

  // 4. TAB NAVIGATION (uses shared renderActiveTab from globals.js)
  const tabs = document.querySelectorAll('.tab-navigation .tab-button');
  tabs.forEach((button) => {
    button.addEventListener('click', (e) => {
      // Save before switching
      if (activeAnalysisId && typeof saveCurrentAnalysisState === 'function') {
        saveCurrentAnalysisState();
      }

      // Toggle buttons
      tabs.forEach((btn) => btn.classList.remove('active'));
      e.target.classList.add('active');

      // Toggle content
      document
        .querySelectorAll('.tab-content')
        .forEach((content) => (content.style.display = 'none'));
      const tabId = e.target.dataset.tab;
      const tabContent = document.getElementById(tabId);
      if (tabContent) {
        tabContent.style.display = 'block';
      }

      // Render active tab content (shared function – DRY)
      const activeAnalysis = getActiveAnalysis();
      if (activeAnalysis) {
        renderActiveTab(activeAnalysis, tabId);
      }
    });
  });

  // 5. BUTTON EVENTS (explicit getElementById for all buttons)
  const btnDeleteAnalysis = document.getElementById('btnDeleteAnalysis');
  if (btnDeleteAnalysis) {
    btnDeleteAnalysis.onclick = () => {
      if (typeof deleteActiveAnalysis === 'function') {
        deleteActiveAnalysis();
      }
    };
  }

  const elBtnExport = document.getElementById('btnExportAnalysis');
  if (elBtnExport) {
    elBtnExport.onclick = () => {
      if (typeof exportAnalysis === 'function') exportAnalysis();
    };
  }

  const elBtnImport = document.getElementById('btnImportAnalysis');
  const elImportFile = document.getElementById('importFileInput');
  const elImportModal = document.getElementById('importAnalysisModal');
  if (elBtnImport) {
    elBtnImport.onclick = () => {
      if (elImportFile) elImportFile.value = '';
      if (elImportModal) elImportModal.style.display = 'block';
    };
  }

  const elBtnNew = document.getElementById('btnNewAnalysis');
  const elNewForm = document.getElementById('newAnalysisForm');
  const elNewModal = document.getElementById('newAnalysisModal');
  if (elBtnNew) {
    elBtnNew.onclick = () => {
      if (elNewForm) elNewForm.reset();
      if (typeof prepareNewAnalysisModal === 'function') prepareNewAnalysisModal();
      if (elNewModal) elNewModal.style.display = 'block';
    };
  }

  const elBtnSave = document.getElementById('btnSave');
  if (elBtnSave) {
    elBtnSave.onclick = () => {
      if (typeof saveCurrentAnalysisState === 'function') saveCurrentAnalysisState();
      if (typeof saveAnalyses === 'function') saveAnalyses();
      if (typeof showToast === 'function')
        showToast(typeof t === 'function' ? t('toast.saved') : 'Analyse gespeichert.', 'success');
    };
  }

  // --- Bewertungsconfig aus JSON-Datei nachladen (portable, ohne Webserver) ---
  window.onAssessmentConfigReloaded = function () {
    try {
      if (typeof populateAttackTreeDropdowns === 'function') populateAttackTreeDropdowns();
    } catch (_) {}
    const analysis = typeof getActiveAnalysis === 'function' ? getActiveAnalysis() : null;
    const activeTab = document.querySelector('.tab-button.active')?.dataset?.tab || 'tabOverview';
    if (analysis && typeof renderActiveTab === 'function') {
      renderActiveTab(analysis, activeTab);
    }
  };

  const btnReloadCfg = document.getElementById('btnReloadAssessmentConfig');
  const cfgFileInput = document.getElementById('assessmentConfigFileInput');
  if (btnReloadCfg && cfgFileInput) {
    btnReloadCfg.onclick = () => {
      if (typeof promptReloadAssessmentConfig === 'function') promptReloadAssessmentConfig();
    };
    cfgFileInput.addEventListener('change', () => {
      const file = cfgFileInput.files && cfgFileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const ok =
          typeof reloadAssessmentConfigFromJsonText === 'function' &&
          reloadAssessmentConfigFromJsonText(ev.target.result, file.name);
        if (ok && typeof showToast === 'function') {
          showToast(
            typeof tf === 'function'
              ? tf('toast.configLoaded', { name: file.name })
              : `Bewertungsconfig geladen: ${file.name}`,
            'success'
          );
        }
      };
      reader.onerror = () => {
        if (typeof showToast === 'function')
          showToast(
            typeof t === 'function'
              ? t('toast.fileReadFail')
              : 'Datei konnte nicht gelesen werden.',
            'error'
          );
      };
      reader.readAsText(file, 'UTF-8');
    });
  }

  const elBtnVersions = document.getElementById('btnShowVersionControl');
  const elVersionModal = document.getElementById('versionControlModal');
  if (elBtnVersions) {
    elBtnVersions.onclick = () => {
      const analysis = getActiveAnalysis();
      if (analysis && typeof renderHistoryTable === 'function') {
        renderHistoryTable(analysis);
        if (elVersionModal) elVersionModal.style.display = 'block';
      }
    };
  }

  // --- Export Baumdaten (ZIP) ---
  const btnExportTreeData = document.getElementById('btnExportTreeData');
  if (btnExportTreeData) {
    btnExportTreeData.onclick = () => {
      if (typeof window.downloadTreeDataZip === 'function') {
        try {
          const p = window.downloadTreeDataZip();
          if (p && typeof p.then === 'function') {
            p.catch((e) => {
              console.error('[TreeExport]', e);
              if (typeof showToast === 'function')
                showToast(
                  typeof t === 'function'
                    ? t('toast.treeExportFail')
                    : 'Baumdaten-Export fehlgeschlagen.',
                  'error'
                );
            });
          }
        } catch (e) {
          console.error('[TreeExport]', e);
          if (typeof showToast === 'function')
            showToast(
              typeof t === 'function'
                ? t('toast.treeExportFail')
                : 'Baumdaten-Export fehlgeschlagen.',
              'error'
            );
        }
      } else if (typeof showToast === 'function') {
        showToast(
          typeof t === 'function'
            ? t('toast.exportUnavailable')
            : 'Export-Funktion nicht verfügbar.',
          'error'
        );
      }
    };
  }

  const btnGenerateReport = document.getElementById('btnGenerateReport');
  if (btnGenerateReport) {
    btnGenerateReport.onclick = () => {
      if (typeof generateReportPdf === 'function') {
        try {
          const p = generateReportPdf();
          if (p && typeof p.then === 'function') {
            p.catch(() => {
              if (typeof showToast === 'function') {
                showToast(
                  typeof t === 'function'
                    ? t('toast.reportFail')
                    : 'Report-Erzeugung fehlgeschlagen.',
                  'error'
                );
              }
            });
          }
        } catch (_) {
          if (typeof showToast === 'function') {
            showToast(
              typeof t === 'function' ? t('toast.reportFail') : 'Report-Erzeugung fehlgeschlagen.',
              'error'
            );
          }
        }
      } else if (typeof showToast === 'function') {
        showToast(
          typeof t === 'function'
            ? t('toast.reportUnavailable')
            : 'Report-Funktion nicht verfügbar (jsPDF fehlt?).',
          'error'
        );
      }
    };
  }

  // 6. Initialize analysis_core modal listeners (consolidated from separate DOMContentLoaded)
  if (typeof initAnalysisCoreListeners === 'function') {
    initAnalysisCoreListeners();
  }

  // 7. Cross-tab synchronization via storage event
  // When another tab/window changes localStorage, reload data to prevent inconsistencies.
  window.addEventListener('storage', (e) => {
    if (e.key !== 'taraAnalyses' || !e.newValue) return;

    try {
      analysisData = JSON.parse(e.newValue);
      if (!Array.isArray(analysisData)) {
        analysisData = [createDefaultAnalysis()];
      }
      analysisData.forEach((a) => migrateAnalysis(a));
    } catch (err) {
      console.warn('[storage sync] Could not parse updated data:', err);
      return;
    }

    // Re-render selector and active analysis
    if (typeof renderAnalysisSelector === 'function') renderAnalysisSelector();

    const current = getActiveAnalysis();
    if (current) {
      if (typeof fillAnalysisForm === 'function') fillAnalysisForm(current);
      if (typeof renderActiveTab === 'function') renderActiveTab(current);
    }

    if (typeof showToast === 'function') {
      showToast(
        typeof t === 'function'
          ? t('toast.syncOtherWindow')
          : 'Daten wurden in einem anderen Fenster geändert – Ansicht aktualisiert.',
        'info'
      );
    }
  });
});
