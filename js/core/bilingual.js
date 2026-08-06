/**
 * @file        bilingual.js
 * @description Localized user-text fields with backward-compatible storage.
 *
 * Storage contract (Auf-/Abwärtskompatibel):
 *   - Primary fields stay plain strings: name, description, short, title, text, …
 *     → old TaraTool builds keep working (ignore *_en).
 *   - Optional parallel fields: name_en, description_en, short_en, title_en, text_en, …
 *     → only used when UI language is EN.
 *
 * UI display (EN, no EN text): show German in parentheses, e.g. "(Deutscher Text)".
 * UI edit (opts.raw): empty until EN is entered (DE only as placeholder).
 * Export (opts.fallback): plain DE if EN empty (PDF/DOT, no parentheses).
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
   * @param {{ fallback?: boolean, raw?: boolean }} [opts]
   * @returns {string}
   */
  function getLocalizedField(obj, field, lang, opts) {
    if (!obj || !field) return '';
    const l = _lang(lang);
    const fallback = !!(opts && opts.fallback);
    const raw = !!(opts && opts.raw);
    if (l === 'en') {
      const enKey = field + '_en';
      if (
        Object.prototype.hasOwnProperty.call(obj, enKey) &&
        obj[enKey] != null &&
        String(obj[enKey]) !== ''
      ) {
        return String(obj[enKey]);
      }
      const deVal = obj[field] != null ? String(obj[field]) : '';
      if (raw) return '';
      if (fallback) return deVal;
      return deVal ? '(' + deVal + ')' : '';
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

  /** DE source text for placeholders (never parentheses). */
  function getPrimaryField(obj, field) {
    if (!obj || !field) return '';
    return obj[field] != null ? String(obj[field]) : '';
  }

  function _escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Wraps paren-fallback segments so users can focus/select them in EN UI.
   * Plain text stays escaped; "(DE text)" → focusable .loc-paren span.
   */
  function localizeParenHtml(text) {
    if (text == null || text === '') return '';
    const parts = String(text).split(' › ');
    return parts
      .map((part) => {
        const t = part.trim();
        if (/^\([\s\S]*\)$/.test(t)) {
          return (
            '<span class="loc-paren" tabindex="0" title="DE (no EN yet) / DE (noch kein EN)">' +
            _escHtml(t) +
            '</span>'
          );
        }
        return _escHtml(part);
      })
      .join(' › ');
  }

  /** Like getLocalizedField, but HTML-safe and paren-fallback markable. */
  function getLocalizedFieldHtml(obj, field, lang, opts) {
    const plain = getLocalizedField(obj, field, lang, opts);
    return localizeParenHtml(plain);
  }

  /**
   * Pick bilingual option/label text (assessment_config options: text / text_en).
   * @param {{ text?: string, text_en?: string, label?: string, label_en?: string }} item
   * @param {'text'|'label'} [kind]
   */
  function getLocalizedOptionText(item, kind, lang) {
    if (!item) return '';
    const l = _lang(lang);
    const base = kind === 'label' ? 'label' : 'text';
    if (l === 'en') {
      const en = item[base + '_en'];
      if (en != null && String(en) !== '') return String(en);
    }
    return item[base] != null ? String(item[base]) : '';
  }

  /**
   * EN without translation: show selectable DE hint next to input (placeholders are not selectable).
   * @param {HTMLInputElement|HTMLTextAreaElement} inputEl
   * @param {object} obj
   * @param {string} field
   * @param {string} [fallbackPh] placeholder when DE or EN present
   */
  function syncLocalizedInputHint(inputEl, obj, field, fallbackPh) {
    if (!inputEl || !inputEl.parentElement) return;
    let wrap = inputEl.closest('.at-bilingual-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'at-bilingual-wrap';
      inputEl.parentElement.insertBefore(wrap, inputEl);
      wrap.appendChild(inputEl);
    }
    let hint = wrap.querySelector('.loc-de-hint');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'loc-paren loc-de-hint';
      hint.tabIndex = 0;
      hint.setAttribute('role', 'note');
      hint.title = 'DE (no EN yet) / DE (noch kein EN) – markierbar / selectable';
      wrap.appendChild(hint);
    }
    const l = _lang();
    const de = getPrimaryField(obj, field);
    const enRaw = getLocalizedField(obj, field, 'en', { raw: true });
    const showHint = l === 'en' && !!de && !enRaw;
    if (showHint) {
      hint.textContent = '(' + de + ')';
      hint.hidden = false;
      inputEl.placeholder = fallbackPh || 'English…';
    } else {
      hint.textContent = '';
      hint.hidden = true;
      inputEl.placeholder = fallbackPh || '';
    }
  }

  window.getLocalizedField = getLocalizedField;
  window.setLocalizedField = setLocalizedField;
  window.copyLocalizedFields = copyLocalizedFields;
  window.getPrimaryField = getPrimaryField;
  window.localizeParenHtml = localizeParenHtml;
  window.getLocalizedFieldHtml = getLocalizedFieldHtml;
  window.getLocalizedOptionText = getLocalizedOptionText;
  window.syncLocalizedInputHint = syncLocalizedInputHint;
})();
