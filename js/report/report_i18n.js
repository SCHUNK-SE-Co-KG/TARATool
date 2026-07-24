/**
 * @file        report_i18n.js
 * @description PDF report fixed strings DE/EN. User content stays as entered.
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */
(function () {
    'use strict';

    const RISK_LABEL_MAP = {
        de: { Kritisch: 'Kritisch', Hoch: 'Hoch', Mittel: 'Mittel', Niedrig: 'Niedrig', Unbekannt: 'Unbekannt' },
        en: { Kritisch: 'Critical', Hoch: 'High', Mittel: 'Medium', Niedrig: 'Low', Unbekannt: 'Unknown' }
    };

    const TREATMENT_MAP = {
        de: { Akzeptiert: 'Akzeptiert', Delegiert: 'Delegiert', Mitigiert: 'Mitigiert', Gemischt: 'Gemischt' },
        en: { Akzeptiert: 'Accepted', Delegiert: 'Delegated', Mitigiert: 'Mitigated', Gemischt: 'Mixed' }
    };

    const STRINGS = {
        de: {
            title: 'Bedrohungs- und Risikoanalyse',
            projectDesc: 'Projektbeschreibung',
            analysisName: 'Analysename',
            author: 'Autor / Verantwortlich',
            version: 'Version',
            date: 'Datum',
            systemDesc: 'Systembeschreibung',
            intendedUse: 'Verwendungszweck',
            reportCreated: 'Report erstellt',
            mgmtSummary: 'Management-Zusammenfassung',
            mgmtIntro: 'Diese Zusammenfassung bietet einen Management-Überblick über die aktuelle Risikoanalyse. Detaillierte Informationen (Assets, Schadensszenarien, Impact-Matrix und Angriffsbäume) folgen in den nachfolgenden Kapiteln.',
            metric: 'Kennzahl',
            value: 'Wert',
            assets: 'Assets',
            dsTotal: 'Schadensszenarien (gesamt)',
            risksTrees: 'Risiken / Angriffsbäume',
            riskDist: 'Risikoverteilung',
            riskDistRr: 'Risikoverteilung Restrisiko',
            topRisks: 'Top Risiken',
            noTopRisks: 'Keine Top-Risiken in den Klassen Hoch oder Kritisch vorhanden.',
            topResidual: 'Top Restrisiken (nach Risikobehandlung)',
            noTopResidual: 'Keine verbleibenden Restrisiken in den Klassen Hoch oder Kritisch vorhanden.',
            colId: 'ID',
            colDesc: 'Beschreibung',
            colR: 'R',
            colClass: 'Klasse',
            colRr: 'RR',
            analysisPrefix: 'Analyse',
            noAssets: 'Keine Assets erfasst.',
            colName: 'Name',
            colType: 'Typ',
            colSchutz: 'Schutzbedarf',
            damageScenarios: 'Schadensszenarien',
            noDs: 'Keine Schadensszenarien definiert.',
            colShort: 'Kurz',
            impactMatrix: 'Schadensauswirkungsmatrix',
            impactMissing: 'Impact-Matrix kann nicht dargestellt werden (Assets oder Szenarien fehlen).',
            impactHint: 'Tabelle: Assets (Y-Achse) vs. Schadensszenarien (X-Achse) mit farbiger Bewertung (High/Medium/Low/N/A).',
            riskAndTrees: 'Risikoanalyse & Angriffsbäume',
            noTrees: 'Keine Angriffsbäume vorhanden.',
            rootOverview: 'Root-Node-Übersicht',
            colRoot: 'Root-Node',
            colP: 'P (K/S/T/U)',
            colInorm: 'I[norm]',
            colRiskClass: 'Risikoklasse',
            colComment: 'Kommentar',
            riskScore: 'Risk Score (R)',
            notes: 'Notizen',
            seeTreeViz: 'siehe Visualisierung Angriffsbäume',
            attackTree: 'Angriffsbaum',
            attackTreeWm: 'Angriffsbaum',
            vizEmbedFail: 'Visualisierung konnte nicht eingebettet werden (Bildkonvertierung fehlgeschlagen).',
            vizSvgFail: 'Visualisierung konnte nicht erzeugt werden (SVG-Konvertierung fehlgeschlagen).',
            vizGraphvizFail: 'Visualisierung konnte nicht erzeugt werden (Graphviz-Service nicht erreichbar).',
            toastTree: 'Erzeuge Angriffsbaum (SVG)…',
            secObjectives: 'Security Objectives',
            noSecObj: 'Keine Security Objectives definiert.',
            colRefRisks: 'Ref. Risiken',
            residualRisk: 'Restrisikoanalyse',
            rootOverviewRr: 'Root-Node-Übersicht (Restrisiko)',
            colPrr: 'P(RR) (K/S/T/U)',
            colRR: 'RR',
            residualEval: 'Bewertung der Restrisiken',
            noResidualData: 'Keine Restrisikoanalyse-Daten vorhanden.',
            noResidualImpacts: 'Keine Auswirkungen in der Restrisikoanalyse gefunden.',
            colTreeName: 'Baum Name',
            colImpact: 'Auswirkung',
            colTreatment: 'Behandlung',
            colMeasure: 'Maßnahme',
            colRemark: 'Anmerkung',
            residualTree: 'Restrisiko-Baum',
            residualWm: 'Restrisiko',
            toastRrTree: 'Erzeuge Restrisiko-Baum (SVG)…',
            rrVizEmbedFail: 'Restrisiko-Visualisierung konnte nicht eingebettet werden (Bildkonvertierung fehlgeschlagen).',
            rrVizSvgFail: 'Restrisiko-Visualisierung konnte nicht erzeugt werden (SVG-Konvertierung fehlgeschlagen).',
            rrVizGraphvizFail: 'Restrisiko-Visualisierung konnte nicht erzeugt werden (Graphviz-Service nicht erreichbar).',
            approval: 'Freigabe',
            signatures: 'Unterschriften',
            roleAuthor: '1. Autor',
            roleReviewer: '2. Reviewer',
            roleApprover: '3. Genehmiger',
            treatment: 'Behandlung',
            pageOf: (i, n) => `Seite ${i} von ${n}`,
            fileBase: 'Bedrohungs_und_Risikoanalyse',
            distLine: (d) => `Kritisch: ${d.Kritisch} | Hoch: ${d.Hoch} | Mittel: ${d.Mittel} | Niedrig: ${d.Niedrig} | Unbekannt: ${d.Unbekannt}`
        },
        en: {
            title: 'Threat and Risk Analysis',
            projectDesc: 'Project description',
            analysisName: 'Analysis name',
            author: 'Author / Owner',
            version: 'Version',
            date: 'Date',
            systemDesc: 'System description',
            intendedUse: 'Intended use',
            reportCreated: 'Report generated',
            mgmtSummary: 'Management summary',
            mgmtIntro: 'This summary provides a management overview of the current risk analysis. Detailed information (assets, damage scenarios, impact matrix and attack trees) follows in subsequent chapters.',
            metric: 'Metric',
            value: 'Value',
            assets: 'Assets',
            dsTotal: 'Damage scenarios (total)',
            risksTrees: 'Risks / attack trees',
            riskDist: 'Risk distribution',
            riskDistRr: 'Residual risk distribution',
            topRisks: 'Top risks',
            noTopRisks: 'No top risks in High or Critical classes.',
            topResidual: 'Top residual risks (after risk treatment)',
            noTopResidual: 'No remaining residual risks in High or Critical classes.',
            colId: 'ID',
            colDesc: 'Description',
            colR: 'R',
            colClass: 'Class',
            colRr: 'RR',
            analysisPrefix: 'Analysis',
            noAssets: 'No assets recorded.',
            colName: 'Name',
            colType: 'Type',
            colSchutz: 'Protection need',
            damageScenarios: 'Damage scenarios',
            noDs: 'No damage scenarios defined.',
            colShort: 'Short',
            impactMatrix: 'Impact matrix',
            impactMissing: 'Impact matrix cannot be shown (assets or scenarios missing).',
            impactHint: 'Table: Assets (Y-axis) vs. damage scenarios (X-axis) with colour-coded rating (High/Medium/Low/N/A).',
            riskAndTrees: 'Risk analysis & attack trees',
            noTrees: 'No attack trees available.',
            rootOverview: 'Root node overview',
            colRoot: 'Root node',
            colP: 'P (K/S/T/U)',
            colInorm: 'I[norm]',
            colRiskClass: 'Risk class',
            colComment: 'Comment',
            riskScore: 'Risk score (R)',
            notes: 'Notes',
            seeTreeViz: 'see attack tree visualisation',
            attackTree: 'Attack tree',
            attackTreeWm: 'Attack tree',
            vizEmbedFail: 'Visualisation could not be embedded (image conversion failed).',
            vizSvgFail: 'Visualisation could not be created (SVG conversion failed).',
            vizGraphvizFail: 'Visualisation could not be created (Graphviz service unreachable).',
            toastTree: 'Generating attack tree (SVG)…',
            secObjectives: 'Security Objectives',
            noSecObj: 'No Security Objectives defined.',
            colRefRisks: 'Ref. risks',
            residualRisk: 'Residual risk analysis',
            rootOverviewRr: 'Root node overview (residual risk)',
            colPrr: 'P(RR) (K/S/T/U)',
            colRR: 'RR',
            residualEval: 'Residual risk assessment',
            noResidualData: 'No residual risk analysis data available.',
            noResidualImpacts: 'No impacts found in residual risk analysis.',
            colTreeName: 'Tree name',
            colImpact: 'Impact',
            colTreatment: 'Treatment',
            colMeasure: 'Measure',
            colRemark: 'Remark',
            residualTree: 'Residual risk tree',
            residualWm: 'Residual risk',
            toastRrTree: 'Generating residual risk tree (SVG)…',
            rrVizEmbedFail: 'Residual risk visualisation could not be embedded (image conversion failed).',
            rrVizSvgFail: 'Residual risk visualisation could not be created (SVG conversion failed).',
            rrVizGraphvizFail: 'Residual risk visualisation could not be created (Graphviz service unreachable).',
            approval: 'Approval',
            signatures: 'Signatures',
            roleAuthor: '1. Author',
            roleReviewer: '2. Reviewer',
            roleApprover: '3. Approver',
            treatment: 'Treatment',
            pageOf: (i, n) => `Page ${i} of ${n}`,
            fileBase: 'Threat_and_Risk_Analysis',
            distLine: (d) => `Critical: ${d.Kritisch} | High: ${d.Hoch} | Medium: ${d.Mittel} | Low: ${d.Niedrig} | Unknown: ${d.Unbekannt}`
        }
    };

    function getReportLang() {
        return (window.TaraPrefs && TaraPrefs.getLang()) || 'de';
    }

    function reportStrings(lang) {
        return STRINGS[lang === 'en' ? 'en' : 'de'];
    }

    function mapRiskLabel(deLabel, lang) {
        const l = lang === 'en' ? 'en' : 'de';
        return (RISK_LABEL_MAP[l][deLabel]) || deLabel || RISK_LABEL_MAP[l].Unbekannt;
    }

    function mapTreatment(deValue, lang) {
        if (!deValue || deValue === '-') return deValue;
        const l = lang === 'en' ? 'en' : 'de';
        return TREATMENT_MAP[l][deValue] || deValue;
    }

    function isHighOrCritical(deLabel) {
        return deLabel === 'Hoch' || deLabel === 'Kritisch';
    }

    window.ReportI18n = {
        getReportLang,
        reportStrings,
        mapRiskLabel,
        mapTreatment,
        isHighOrCritical,
        STRINGS
    };
})();
