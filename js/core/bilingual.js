/**
 * @file        bilingual.js
 * @description Localized user-text fields with backward-compatible storage.
 *
 * Storage contract (Auf-/Abwärtskompatibel):
 *   - Primary fields stay plain strings: name, description, short, …
 *     → old TaraTool builds keep working (ignore *_en).
 *   - Optional parallel fields: name_en, description_en, short_en, …
 *     → only used when UI language is EN.
 *
 * UI rule: no cross-language fallback when reading for display
 *   (EN empty until user enters EN text).
 * Export rule: optional fallback to DE so PDFs/DOT stay readable.
 */
(function () {
    'use strict';

    function _lang(explicit) {
        if (explicit === 'en' || explicit === 'de') return explicit;
        return (window.TaraPrefs && TaraPrefs.getLang()) || 'de';
    }

    /**
     * @param {object} obj
     * @param {string} field - base field name (e.g. 'name')
     * @param {string} [lang]
     * @param {{ fallback?: boolean }} [opts] - fallback:true → use DE if EN empty (exports)
     * @returns {string}
     */
    function getLocalizedField(obj, field, lang, opts) {
        if (!obj || !field) return '';
        const l = _lang(lang);
        const fallback = !!(opts && opts.fallback);
        if (l === 'en') {
            const enKey = field + '_en';
            if (Object.prototype.hasOwnProperty.call(obj, enKey) && obj[enKey] != null && String(obj[enKey]) !== '') {
                return String(obj[enKey]);
            }
            if (fallback && obj[field] != null) return String(obj[field]);
            return '';
        }
        return obj[field] != null ? String(obj[field]) : '';
    }

    /**
     * Writes into the language-specific slot without wiping the other language.
     * @param {object} obj
     * @param {string} field
     * @param {string} value
     * @param {string} [lang]
     * @returns {object}
     */
    function setLocalizedField(obj, field, value, lang) {
        if (!obj || !field) return obj;
        const l = _lang(lang);
        const v = value == null ? '' : String(value);
        if (l === 'en') {
            obj[field + '_en'] = v;
        } else {
            obj[field] = v;
        }
        return obj;
    }

    /** Copy bilingual slots when cloning entities. */
    function copyLocalizedFields(src, dest, fields) {
        if (!src || !dest || !Array.isArray(fields)) return dest;
        fields.forEach((f) => {
            if (src[f] !== undefined) dest[f] = src[f];
            const en = f + '_en';
            if (src[en] !== undefined) dest[en] = src[en];
        });
        return dest;
    }

    window.getLocalizedField = getLocalizedField;
    window.setLocalizedField = setLocalizedField;
    window.copyLocalizedFields = copyLocalizedFields;
})();
