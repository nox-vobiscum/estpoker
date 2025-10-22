/* /static/js/header-controls.js  (v10-compatible)
   - Works with fragments/header-controls.html (hcLangEN / hcLangDE)
   - Delegates to window.setLanguage (menu.js v40) if present
   - Fallback: fetches /i18n/messages and applies data-i18n / data-i18n-attr / data-i18n-dyn
   - Keeps theme persistence/apply but has no theme UI here
   - Emits 'est:lang-change' (and back-compat 'estpoker:lang-change')
*/
(function () {
  'use strict';

  const root = document.documentElement;
  const LS = window.localStorage;

  /* ---------- Theme (no UI here; keep persistence + initial apply) ---------- */
  const getTheme = () => LS.getItem('estpoker-theme') || LS.getItem('theme') || LS.getItem('themeMode') || 'system';
  const setThemeLS = (mode) => {
    const m = ['light', 'dark', 'system'].includes(mode) ? mode : 'system';
    LS.setItem('estpoker-theme', m);
    LS.setItem('theme', m);
    LS.setItem('themeMode', m);
  };
  const applyTheme = (mode) => {
    const m = ['light', 'dark', 'system'].includes(mode) ? mode : 'system';
    if (m === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', m);
    setThemeLS(m);
  };

  /* ---------- Language helpers ---------- */
  const norm = (l) => (String(l || '').toLowerCase().startsWith('de') ? 'de' : 'en');
  const getLang = () => norm(LS.getItem('lang') || root.getAttribute('lang') || 'en');

  // Tiny formatter for data-i18n-dyn
  function fmt(str, params) {
    if (!str || !params) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => {
      if (Object.prototype.hasOwnProperty.call(params, k)) return params[k];
      const i = Number(k);
      return Number.isFinite(i) && params[i] != null ? params[i] : `{${k}}`;
    });
  }

  // Apply an i18n map to data-i18n / data-i18n-attr / data-i18n-dyn
  function applyI18nMap(map) {
    if (!map) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && map[key] != null) el.textContent = map[key];
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr') || '';
      spec.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s && s.trim());
        if (attr && key && map[key] != null) el.setAttribute(attr, map[key]);
      });
    });
    document.querySelectorAll('[data-i18n-dyn]').forEach(el => {
      const key = el.getAttribute('data-i18n-dyn');
      const tmpl = key && map[key];
      if (!tmpl) return;
      const params = {};
      Object.entries(el.dataset).forEach(([k, v]) => {
        if (k === 'i18nDyn') return;
        if (/^arg\d+$/.test(k)) params[Number(k.slice(3))] = v;
        else params[k] = v;
      });
      el.innerHTML = fmt(tmpl, params);
    });
  }

  async function fetchMessages(code) {
    const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(norm(code))}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`i18n HTTP ${res.status}`);
    return res.json();
  }

  /* ---------- Flag helpers ---------- */
  function setFlagPair(containerEl, lang) {
    if (!containerEl) return;
    const a = containerEl.querySelector('.flag-a');
    const b = containerEl.querySelector('.flag-b');
    const pair = (lang === 'de') ? ['de', 'at'] : ['us', 'gb'];
    if (a) { a.src = `/flags/${pair[0]}.svg`; a.alt = ''; }
    if (b) { b.src = `/flags/${pair[1]}.svg`; b.alt = ''; }
  }

  /* ---------- Reflect Language UI ---------- */
  function reflectLangUI(lang) {
    const isDE = lang === 'de';
    const enBtn = document.getElementById('hcLangEN');
    const deBtn = document.getElementById('hcLangDE');

    if (enBtn) {
      setFlagPair(enBtn, 'en');
      enBtn.classList.toggle('active', !isDE);
      enBtn.setAttribute('aria-pressed', !isDE ? 'true' : 'false');
      enBtn.title = 'Language: English';
      enBtn.setAttribute('aria-label', enBtn.title);
    }
    if (deBtn) {
      setFlagPair(deBtn, 'de');
      deBtn.classList.toggle('active', isDE);
      deBtn.setAttribute('aria-pressed', isDE ? 'true' : 'false');
      deBtn.title = 'Language: German';
      deBtn.setAttribute('aria-label', deBtn.title);
    }
  }

  /* ---------- Compact-mode helpers (≤420px) ---------- */
  function isCompactGroup(groupEl) {
    // In compact CSS we hide the "inactive" segment; we use the container width as a proxy.
    try { return window.matchMedia && window.matchMedia('(max-width: 420px)').matches; } catch { return false; }
  }
  function stop(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }

  /* ---------- Set language (delegates to menu.js if available) ---------- */

    async function setLang(lang) {
      const target = (String(lang || '').toLowerCase().startsWith('de') ? 'de' : 'en');

      // 1) Delegate to menu.js (single source of truth). Do NOT pre-set LS / html[lang] here,
      //    otherwise menu.js may early-return and skip applying messages.
      let delegated = false;
      if (typeof window.setLanguage === 'function') {
        try {
          await window.setLanguage(target);  // menu.js fetches + applies messages + tooltips
          delegated = true;
        } catch (e) {
          console.warn('[hc] setLanguage bridge failed, will fallback', e);
        }
      }

      // 2) Fallback: apply messages locally (for pages without menu.js)
      if (!delegated) {
        try {
          const map = await fetchMessages(target);
          applyI18nMap(map); // updates all data-i18n / data-i18n-attr / data-i18n-dyn
        } catch (e) {
          console.warn('[hc] fetching/applying messages failed', e);
        }
      }

      // 3) Persist + reflect AFTER messages to avoid guards in menu.js
      try {
        localStorage.setItem('lang', target);
        document.documentElement.setAttribute('lang', target);
      } catch {}

      // 4) Update header flags & notify the app
      reflectLangUI(target);
      try { window.dispatchEvent(new CustomEvent('est:lang-change', { detail: { lang: target, source: 'header' } })); } catch {}
      try { document.dispatchEvent(new CustomEvent('estpoker:lang-change', { detail: { lang: target } })); } catch {}

      return target;
    }



  /* ---------- Init ---------- */
  function init() {
    // Apply theme from LS (no UI here)
    try { applyTheme(getTheme()); } catch {}

    const group = document.getElementById('hcLang');
    const langEN = document.getElementById('hcLangEN');
    const langDE = document.getElementById('hcLangDE');

    // If header controls are not present, nothing to do
    if (!group || (!langEN && !langDE)) return;

    // Initial flags + ARIA state
    const cur = getLang();
    root.setAttribute('lang', cur);
    reflectLangUI(cur);

    // Desktop/non-compact: explicit per-button behavior
    langEN?.addEventListener('click', async (e) => {
      stop(e);
      const cur = getLang(); if (cur !== 'en') reflectLangUI(await setLang('en'));
    });
    langDE?.addEventListener('click', async (e) => {
      stop(e);
      const cur = getLang(); if (cur !== 'de') reflectLangUI(await setLang('de'));
    });

    // Compact mode: the visible segment cycles EN↔DE
    group.addEventListener('click', async (e) => {
      if (!isCompactGroup(group)) return;
      stop(e);
      const next = getLang() === 'de' ? 'en' : 'de';
      reflectLangUI(await setLang(next));
    });
    group.addEventListener('keydown', async (e) => {
      if (!isCompactGroup(group)) return;
      if (e.key === 'Enter' || e.key === ' ') { stop(e); const next = getLang() === 'de' ? 'en' : 'de'; reflectLangUI(await setLang(next)); }
    });

    // When the menu switches language, mirror the flags promptly
    window.addEventListener('est:lang-change', (e) => {
      try { reflectLangUI(norm(e?.detail?.lang || e?.detail?.to || getLang())); } catch {}
    });

    // When the menu changes theme, reflect the theme (no header UI)
    window.addEventListener('est:theme-change', (e) => {
      try { applyTheme(e?.detail?.mode || getTheme()); } catch {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
