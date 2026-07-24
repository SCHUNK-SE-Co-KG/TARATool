/**
 * @file        i18n.js
 * @description Fixed UI strings DE/EN. User-entered content is never translated.
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */
(function () {
    'use strict';

    const UI = {
        de: {
            'nav.new': 'Neu',
            'nav.import': 'Import',
            'nav.export': 'Export',
            'nav.about': 'About',
            'nav.save': 'Speichern',
            'nav.versions': 'Versionen',
            'nav.delete': 'Analyse löschen',
            'prefs.dark': 'Dark',
            'prefs.lang': 'EN',
            'tab.overview': 'Übersicht',
            'tab.assets': 'Assets',
            'tab.ds': 'Schadensszenarien',
            'tab.risk': 'Risikoanalyse',
            'tab.sg': 'Security Ziele',
            'tab.rr': 'Restrisikoanalyse',
            'btn.report': 'Report (PDF)',
            'btn.exportTrees': 'Export Baumdaten',
            'btn.config': 'Bewertungsconfig laden',
            'btn.edit': 'Bearbeiten',
            'btn.delete': 'Löschen',
            'btn.cancel': 'Abbrechen',
            'btn.ok': 'OK',
            'btn.createTree': 'Neuen Angriffsbaum erstellen',
            'btn.exportDot': 'Export (.dot)',
            'stat.assets': 'Assets',
            'stat.scenarios': 'Szenarien',
            'stat.risks': 'Risiken (Gesamt)',
            'stat.dist': 'Risikoverteilung',
            'stat.distRr': 'Risikoverteilung Restrisiko',
            'label.critical': 'Kritisch',
            'label.high': 'Hoch',
            'label.medium': 'Mittel',
            'label.low': 'Niedrig',
            'label.unknown': 'Unbekannt',
            'overview.project': 'Projektbeschreibung',
            'overview.name': 'Analysename',
            'overview.author': 'Autor / Verantwortlich',
            'overview.desc': 'Systembeschreibung',
            'overview.use': 'Verwendungszweck',
            'risk.title': 'Risikoanalyse & Angriffsbäume',
            'risk.rootOverview': 'Root-Node-Übersicht (alle Angriffsbäume):',
            'risk.savedTrees': 'Gespeicherte Angriffsbäume:',
            'risk.none': 'Noch keine Angriffs-Bäume angelegt.',
            'risk.missingAssets': 'Fehlende Daten: Assets',
            'risk.missingAssetsHint': 'Es wurden noch keine Schutzobjekte (Assets) im Reiter "Assets" erfasst.',
            'risk.missingDs': 'Fehlende Daten: Schadensszenarien',
            'risk.missingDsHint': 'Bitte definieren Sie zuerst Schadensszenarien.',
            'risk.score': 'Risk Score (R):',
            'risk.notes': 'Notizen',
            'toast.reportOk': 'PDF Report erstellt.',
            'toast.noAnalysis': 'Keine aktive Analyse ausgewählt.',
            'toast.pdfMissing': 'PDF-Erzeugung nicht verfügbar (jsPDF nicht geladen).',
            'status.start': 'Bitte starten Sie eine neue Analyse.',
            'confirm.cancel': 'Abbrechen',
            'confirm.ok': 'OK',
            'btn.addAsset': 'Asset hinzufügen',
            'btn.addDs': 'Neu',
            'btn.addSg': 'Security Ziel hinzufügen',
            'assets.empty': 'Noch keine Assets vorhanden. Klicken Sie auf "Asset hinzufügen".',
            'assets.type': 'Typ:',
            'assets.noDesc': 'Keine Beschreibung',
            'assets.schutz': 'Schutzbedarf',
            'ds.admin': 'Verwaltung',
            'ds.defined': 'Definierte Schadens-Szenarien:',
            'ds.hint': 'Verwalten Sie die Damage Scenarios (DS), die zur Bewertung der Assets verwendet werden.',
            'ds.standard': '(Standard)',
            'ds.noDesc': '— Keine Beschreibung —',
            'ds.matrixTitle': 'Schadensauswirkungsmatrix',
            'ds.matrixSub': 'Schadensauswirkungsmatrix (Assets vs. Damage Scenarios)',
            'ds.matrixHint': 'Bewerten Sie die Auswirkung (Impact) jedes Schadensszenarios auf jedes Asset (1=Low, 3=High, N/A=Nicht anwendbar).',
            'ds.needAssets': 'Bitte legen Sie zuerst Assets im Reiter "Assets" an.',
            'ds.needDs': 'Bitte definieren Sie zuerst Schadensszenarien.',
            'risk.panelTitle': 'Risikoanalyse & Angriffsbäume'
        },
        en: {
            'nav.new': 'New',
            'nav.import': 'Import',
            'nav.export': 'Export',
            'nav.about': 'About',
            'nav.save': 'Save',
            'nav.versions': 'Versions',
            'nav.delete': 'Delete analysis',
            'prefs.dark': 'Dark',
            'prefs.lang': 'EN',
            'tab.overview': 'Overview',
            'tab.assets': 'Assets',
            'tab.ds': 'Damage scenarios',
            'tab.risk': 'Risk analysis',
            'tab.sg': 'Security goals',
            'tab.rr': 'Residual risk',
            'btn.report': 'Report (PDF)',
            'btn.exportTrees': 'Export tree data',
            'btn.config': 'Load assessment config',
            'btn.edit': 'Edit',
            'btn.delete': 'Delete',
            'btn.cancel': 'Cancel',
            'btn.ok': 'OK',
            'btn.createTree': 'Create new attack tree',
            'btn.exportDot': 'Export (.dot)',
            'stat.assets': 'Assets',
            'stat.scenarios': 'Scenarios',
            'stat.risks': 'Risks (total)',
            'stat.dist': 'Risk distribution',
            'stat.distRr': 'Residual risk distribution',
            'label.critical': 'Critical',
            'label.high': 'High',
            'label.medium': 'Medium',
            'label.low': 'Low',
            'label.unknown': 'Unknown',
            'overview.project': 'Project description',
            'overview.name': 'Analysis name',
            'overview.author': 'Author / Owner',
            'overview.desc': 'System description',
            'overview.use': 'Intended use',
            'risk.title': 'Risk analysis & attack trees',
            'risk.rootOverview': 'Root node overview (all attack trees):',
            'risk.savedTrees': 'Saved attack trees:',
            'risk.none': 'No attack trees created yet.',
            'risk.missingAssets': 'Missing data: Assets',
            'risk.missingAssetsHint': 'No assets have been recorded in the Assets tab yet.',
            'risk.missingDs': 'Missing data: Damage scenarios',
            'risk.missingDsHint': 'Please define damage scenarios first.',
            'risk.score': 'Risk score (R):',
            'risk.notes': 'Notes',
            'toast.reportOk': 'PDF report created.',
            'toast.noAnalysis': 'No active analysis selected.',
            'toast.pdfMissing': 'PDF generation unavailable (jsPDF not loaded).',
            'status.start': 'Please start a new analysis.',
            'confirm.cancel': 'Cancel',
            'confirm.ok': 'OK',
            'btn.addAsset': 'Add asset',
            'btn.addDs': 'New',
            'btn.addSg': 'Add security goal',
            'assets.empty': 'No assets yet. Click "Add asset".',
            'assets.type': 'Type:',
            'assets.noDesc': 'No description',
            'assets.schutz': 'Protection need',
            'ds.admin': 'Management',
            'ds.defined': 'Defined damage scenarios:',
            'ds.hint': 'Manage the damage scenarios (DS) used to assess assets.',
            'ds.standard': '(Standard)',
            'ds.noDesc': '— No description —',
            'ds.matrixTitle': 'Impact matrix',
            'ds.matrixSub': 'Impact matrix (Assets vs. Damage Scenarios)',
            'ds.matrixHint': 'Rate the impact of each damage scenario on each asset (1=Low, 3=High, N/A=Not applicable).',
            'ds.needAssets': 'Please create assets in the Assets tab first.',
            'ds.needDs': 'Please define damage scenarios first.',
            'risk.panelTitle': 'Risk analysis & attack trees'
        }
    };

    const RISK_KEY = {
        Kritisch: 'label.critical',
        Hoch: 'label.high',
        Mittel: 'label.medium',
        Niedrig: 'label.low',
        Unbekannt: 'label.unknown'
    };

    function t(key, lang) {
        const l = lang || (window.TaraPrefs && TaraPrefs.getLang()) || 'de';
        const pack = UI[l] || UI.de;
        return pack[key] || UI.de[key] || key;
    }

    /** Map internal DE risk class label to current UI language (fixed text only). */
    function tRiskLabel(deLabel, lang) {
        const key = RISK_KEY[deLabel];
        return key ? t(key, lang) : (deLabel || t('label.unknown', lang));
    }

    function applyUiI18n(lang) {
        const l = lang || (window.TaraPrefs && TaraPrefs.getLang()) || 'de';
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const text = t(key, l);
            const icon = el.querySelector(':scope > i');
            if (icon) {
                el.innerHTML = '';
                el.appendChild(icon);
                el.appendChild(document.createTextNode(' ' + text));
            } else {
                el.textContent = text;
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach((el) => {
            const key = el.getAttribute('data-i18n-title');
            if (key) el.title = t(key, l);
        });
    }

    window.t = t;
    window.tRiskLabel = tRiskLabel;
    window.applyUiI18n = applyUiI18n;
    window.UI_I18N = UI;
})();
