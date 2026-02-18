/**
 * @file        tab_dispatcher.js
 * @description Centralized tab rendering dispatcher – routes tab IDs to their render functions.
 *              Extracted from globals.js to break the circular dependency where globals.js
 *              (loaded 2nd) referenced 8 render functions from later-loaded modules.
 *              This file is loaded after all modules and before init.js.
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 * @pattern     No IIFE – single public function. ES-Module migration-ready.
 */

/**
 * Renders the content of the currently active tab for the given analysis.
 * @param {object} analysis - The analysis data object to render
 * @param {string} [tabId] - Optional explicit tab ID. If omitted, reads from active tab button.
 */
function renderActiveTab(analysis, tabId) {
    if (!analysis) return;

    if (!tabId) {
        const activeTabBtn = document.querySelector('.tab-button.active');
        if (!activeTabBtn) return;
        tabId = activeTabBtn.dataset.tab;
    }

    if (tabId === 'tabOverview') {
        if (typeof renderOverview === 'function') renderOverview(analysis);
    }
    else if (tabId === 'tabAssets') {
        if (typeof renderAssets === 'function') renderAssets(analysis);
    }
    else if (tabId === 'tabDamageScenarios') {
        if (typeof renderDamageScenarios === 'function') renderDamageScenarios();
        if (typeof renderImpactMatrix === 'function') renderImpactMatrix();
    }
    else if (tabId === 'tabSecurityGoals') {
        if (typeof renderSecurityGoals === 'function') renderSecurityGoals(analysis);
    }
    else if (tabId === 'tabRiskAnalysis') {
        if (typeof renderRiskAnalysis === 'function') renderRiskAnalysis();
    }
    else if (tabId === 'tabResidualRisk') {
        if (typeof renderResidualRisk === 'function') renderResidualRisk(analysis);
    }
}
