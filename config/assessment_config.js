/**
 * @file assessment_config.js
 * @description Portable assessment config for file:// usage (no web server).
 *              AUTO-GENERATED from assessment_config.json - do not edit by hand.
 *              After changing the JSON, run:
 *                Windows: tools/sync_assessment_config.bat
 *                Linux/macOS: tools/sync_assessment_config.sh
 *                oder: python3 tools/sync_assessment_config.py
 */
window.__ASSESSMENT_CONFIG_PRELOAD__ = {
  _meta: {
    version: '1.0',
    description:
      'Assessment configuration for TARA Tool – impact matrix scalars, risk thresholds and probability criteria. This file can be updated independently during annual reviews without changing source code.',
    lastModified: '2026-02-19',
    author: 'SCHUNK SE & Co. KG',
  },
  impactScale: {
    validValues: ['N/A', '1', '2', '3'],
    labels: {
      'N/A': 'N/A',
      1: 'Low',
      2: 'Medium',
      3: 'High',
    },
    cssClasses: {
      3: 'impact-high',
      2: 'impact-medium',
      1: 'impact-low',
      'N/A': 'impact-na',
    },
  },
  severityLevelFactors: {
    0: 0.0,
    1: 0.3,
    2: 0.6,
    3: 1.0,
  },
  protectionLevels: {
    weights: {
      I: 0.6,
      II: 0.8,
      III: 1.0,
    },
    ranking: {
      '-': 0,
      I: 1,
      II: 2,
      III: 3,
    },
  },
  probabilityCriteria: {
    K: {
      label: 'K (Komplexität)',
      label_en: 'K (Complexity)',
      fullLabel: 'Komplexität (Knowledge / Complexity)',
      fullLabel_en: 'Complexity (Knowledge)',
      options: [
        {
          value: '0.7',
          text: '0,7 - Bekannte Schwachstellen (z.B. CVE, Errata)',
          text_en: '0.7 - Known vulnerabilities (e.g. CVE, errata)',
        },
        {
          value: '0.6',
          text: '0,6 - Einfache Internetrecherche (z.B. einfache Foren)',
          text_en: '0.6 - Simple internet research (e.g. basic forums)',
        },
        {
          value: '0.3',
          text: '0,3 - Experten Recherche (z.B. spezifische Foren, Onionnet)',
          text_en: '0.3 - Expert research (e.g. specialised forums, onion network)',
        },
        {
          value: '0.1',
          text: '0,1 - Expertenwissen',
          text_en: '0.1 - Expert knowledge',
        },
      ],
    },
    S: {
      label: 'S (Skalierung)',
      label_en: 'S (Scaling)',
      fullLabel: 'Skalierung (Scaling)',
      fullLabel_en: 'Scaling',
      options: [
        {
          value: '0.5',
          text: '0,5 - IT-Netzwerk beim Kunden',
          text_en: '0.5 - Customer IT network',
        },
        {
          value: '0.3',
          text: '0,3 - OT-Netzwerk beim Kunden',
          text_en: '0.3 - Customer OT network',
        },
        {
          value: '0.1',
          text: '0,1 - Einzelprodukt/ lokale Maschine',
          text_en: '0.1 - Single product / local machine',
        },
      ],
    },
    T: {
      label: 'T (Zeit)',
      label_en: 'T (Time)',
      fullLabel: 'Zeit / Aufwand (Time)',
      fullLabel_en: 'Time / effort',
      options: [
        {
          value: '0.5',
          text: '0,5 - < 1 Woche',
          text_en: '0.5 - < 1 week',
        },
        {
          value: '0.4',
          text: '0,4 - < 4 Wochen',
          text_en: '0.4 - < 4 weeks',
        },
        {
          value: '0.2',
          text: '0,2 - < 3 Monate',
          text_en: '0.2 - < 3 months',
        },
        {
          value: '0.1',
          text: '0,1 - > 3 Monate',
          text_en: '0.1 - > 3 months',
        },
      ],
    },
    U: {
      label: 'U (Nutzen)',
      label_en: 'U (Utility)',
      fullLabel: 'Sichtbarer Nutzen für Angreifer (Utility)',
      fullLabel_en: 'Visible benefit for the attacker (Utility)',
      options: [
        {
          value: '0.5',
          text: '0,5 - Groß',
          text_en: '0.5 - High',
        },
        {
          value: '0.3',
          text: '0,3 - Mittel',
          text_en: '0.3 - Medium',
        },
        {
          value: '0.1',
          text: '0,1 - Klein',
          text_en: '0.1 - Low',
        },
      ],
    },
  },
  riskThresholds: [
    {
      min: 2.0,
      label: 'Kritisch',
      labelEn: 'critical',
      color: '#c0392b',
      colorRGB: [192, 57, 43],
    },
    {
      min: 1.6,
      label: 'Hoch',
      labelEn: 'high',
      color: '#e67e22',
      colorRGB: [230, 126, 34],
    },
    {
      min: 0.8,
      label: 'Mittel',
      labelEn: 'medium',
      color: '#f39c12',
      colorRGB: [243, 156, 18],
    },
    {
      min: 0,
      label: 'Niedrig',
      labelEn: 'low',
      color: '#27ae60',
      colorRGB: [39, 174, 96],
    },
  ],
  riskUnknown: {
    label: 'Unbekannt',
    color: '#7f8c8d',
    colorRGB: [127, 140, 141],
  },
  defaultDamageScenarios: [
    {
      id: 'DS1',
      name: 'Gefahr für Leib und Leben',
      name_en: 'Danger to life and limb',
      short: 'Safety',
      short_en: 'Safety',
      description: 'Verletzung von Personen oder lebensbedrohliche Situationen.',
      description_en: 'Injury to persons or life-threatening situations.',
    },
    {
      id: 'DS2',
      name: 'Finanzieller Schaden',
      name_en: 'Financial damage',
      short: 'Financial',
      short_en: 'Financial',
      description: 'Direkte oder indirekte finanzielle Verluste (Rückruf, Schadensersatz).',
      description_en: 'Direct or indirect financial losses (recall, damages).',
    },
    {
      id: 'DS3',
      name: 'Verlust von geistigem Eigentum',
      name_en: 'Loss of intellectual property',
      short: 'IP loss',
      short_en: 'IP loss',
      description: 'Verlust von geistigem Eigentum (Patente, Urheberrechte, etc.).',
      description_en: 'Loss of intellectual property (patents, copyrights, etc.).',
    },
    {
      id: 'DS4',
      name: 'Verlust Privatsphäre/Daten',
      name_en: 'Loss of privacy/data',
      short: 'Privacy',
      short_en: 'Privacy',
      description: 'Verlust sensibler persönlicher oder technischer Daten.',
      description_en: 'Loss of sensitive personal or technical data.',
    },
    {
      id: 'DS5',
      name: 'Rechtliche Konsequenzen',
      name_en: 'Legal consequences',
      short: 'Legal',
      short_en: 'Legal',
      description: 'Verstoß gegen Gesetze oder Vorschriften.',
      description_en: 'Violation of laws or regulations.',
    },
  ],
  strideCategories: [
    {
      id: 'S',
      name: 'Spoofing (Identitätstäuschung)',
      name_en: 'Spoofing (identity deception)',
      short: 'S',
      description:
        'Kann sich ein Angreifer oder ein fremdes Gerät als vertrauenswürdiger Teilnehmer ausgeben, um Zugriff zu erhalten? (z. B. ein gefälschtes Servicetool).',
      description_en:
        'Can an attacker or foreign device impersonate a trusted participant to gain access? (e.g. a forged service tool).',
    },
    {
      id: 'T',
      name: 'Tampering (Manipulation)',
      name_en: 'Tampering (manipulation)',
      short: 'T',
      description:
        'Können Daten, Parameter, Konfigurationen oder die Firmware auf dem Gerät oder während der Übertragung unbefugt verändert werden?',
      description_en:
        'Can data, parameters, configurations or firmware on the device or in transit be changed without authorisation?',
    },
    {
      id: 'R',
      name: 'Repudiation (Abstreitbarkeit)',
      name_en: 'Repudiation (non-repudiation gap)',
      short: 'R',
      description:
        'Können kritische Aktionen durchgeführt werden, ohne dass wir im Nachhinein nachweisen können, wer es war? (Fehlende oder manipulierbare Logs).',
      description_en:
        'Can critical actions be performed without us later being able to prove who did them? (Missing or tamperable logs).',
    },
    {
      id: 'I',
      name: 'Information Disclosure (Informationsenthüllung)',
      name_en: 'Information Disclosure',
      short: 'I',
      description:
        'Können schützenswerte Informationen (z. B. Passwörter, Rezepturen, Kundendaten oder Know-how) von Unbefugten ausgelesen werden?',
      description_en:
        'Can sensitive information (e.g. passwords, recipes, customer data or know-how) be read by unauthorised parties?',
    },
    {
      id: 'D',
      name: 'Denial of Service (Dienstverweigerung)',
      name_en: 'Denial of Service',
      short: 'D',
      description:
        'Kann das System so sabotiert oder überlastet werden, dass es seine Funktion einstellt oder träge wird? (z. B. Blockade der Steuerung).',
      description_en:
        'Can the system be sabotaged or overloaded so that it stops working or becomes sluggish? (e.g. blocking the controller).',
    },
    {
      id: 'E',
      name: 'Elevation of Privilege (Rechteausweitung)',
      name_en: 'Elevation of Privilege',
      short: 'E',
      description:
        'Kann ein Nutzer mit geringen Rechten (z. B. Gast/Operator) Berechtigungen erlangen, die ihm nicht zustehen (z. B. Admin-/Service-Rechte)?',
      description_en:
        'Can a low-privilege user (e.g. guest/operator) obtain permissions they should not have (e.g. admin/service rights)?',
    },
  ],
};
