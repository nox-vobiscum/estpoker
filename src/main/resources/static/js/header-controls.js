/* /static/js/header-controls.js (v14 - unified desktop/mobile behavior)
   - Always show and handle BOTH language buttons (EN & DE) on all breakpoints.
   - No compact/toggle logic anymore. One behavior for desktop & mobile.
   - Uses window.setLanguage(target) if available; otherwise:
       1) /i18n?lang=... to set server-locale
       2) /i18n/messages?lang=... then apply to DOM
   - Correct flags: DE → (de, at), EN → (us, gb)
   - Persists lang in localStorage and updates <html lang="...">
   - Emits 'est:lang-change' + 'ep:lang-changed' events
*/
(() => {
  'use strict';

  const root = document.documentElement;
  const LS   = window.localStorage;

  /* ------------------------------- Theme ---------------------------------- */
  const THEME_KEY = 'estpoker-theme';
  const getTheme = () => LS.getItem(THEME_KEY) || LS.getItem('theme') || LS.getItem('themeMode') || 'system';
  const applyTheme = (mode) => {
    const m = (mode || getTheme());
    if (m === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', m);
    try { LS.setItem(THEME_KEY, m); LS.setItem('theme', m); LS.setItem('themeMode', m); } catch {}
  };

  /* ------------------------------- i18n helpers --------------------------- */
  const LANG_KEY = 'lang';
  const norm = (s) => String(s || '').toLowerCase().startsWith('de') ? 'de' : 'en';
  const getLang = () => norm(root.getAttribute('lang') || LS.getItem(LANG_KEY) || navigator.language || navigator.userLanguage);

  const fmt = (str, params) => String(str).replace(/\{(\w+)\}/g, (_, k) => {
    if (Object.prototype.hasOwnProperty.call(params, k)) return params[k];
    const i = Number(k); return Number.isFinite(i) ? (params[i] ?? `{${k}}`) : `{${k}}`;
  });

  function applyI18nMap(map, scope = document) {
    if (!map) return;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && map[key] != null) el.textContent = map[key];
    });
    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr') || '';
      spec.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s && s.trim());
        if (attr && key && map[key] != null) el.setAttribute(attr, map[key]);
      });
    });
    scope.querySelectorAll('[data-i18n-dyn]').forEach((el) => {
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

  async function setServerLocale(code) {
    try {
      await fetch(`/i18n?lang=${encodeURIComponent(code)}`, { credentials: 'same-origin', cache: 'no-store' });
    } catch (e) {
      console.warn('[hc v14] setServerLocale failed', e);
    }
  }

  async function fetchMessages(code) {
    const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(code)}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) throw new Error(`i18n HTTP ${res.status}`);
    return res.json();
  }

  /* ----------------------------- Flags (Header) --------------------------- */
  function setFlagPair(btnEl, lang) {
    if (!btnEl) return;
    const a = btnEl.querySelector('.flag-a');
    const b = btnEl.querySelector('.flag-b');
    if (!a || !b) return;
    if (lang === 'de') { a.src = '/flags/de.svg'; b.src = '/flags/at.svg'; }
    else               { a.src = '/flags/us.svg'; b.src = '/flags/gb.svg'; }
    a.alt = ''; b.alt = '';
  }
  function reflectLangUI(lang) {
    const isDE = (lang === 'de');
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

  /* ------------------------------- Set Lang -------------------------------- */
  async function setLang(lang) {
    const target = norm(lang);
    let delegated = false;

    if (typeof window.setLanguage === 'function') {
      try { await window.setLanguage(target); delegated = true; }
      catch (e) { console.warn('[hc v14] setLanguage bridge failed; will fallback', e); }
    }

    if (!delegated) {
      try {
        await setServerLocale(target);
        const map = await fetchMessages(target);
        applyI18nMap(map, document);
      } catch (e) {
        console.warn('[hc v14] local i18n apply failed', e);
      }
    }

    try { LS.setItem(LANG_KEY, target); } catch {}
    root.setAttribute('lang', target);
    reflectLangUI(target);

    const detail = { lang: target, source: 'header' };
    try { window.dispatchEvent(new CustomEvent('est:lang-change', { detail })); } catch {}
    try { document.dispatchEvent(new CustomEvent('ep:lang-changed', { detail })); } catch {}

    return target;
  }

  /* --------------------------------- Init --------------------------------- */
  function init() {
    try { applyTheme(getTheme()); } catch {}

    const langEN = document.getElementById('hcLangEN');
    const langDE = document.getElementById('hcLangDE');
    if (!langEN && !langDE) return;

    const cur = getLang();
    root.setAttribute('lang', cur);
    reflectLangUI(cur);

    // One behavior for all breakpoints: per-button click
    langEN?.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (getLang() !== 'en') await setLang('en');
    });
    langDE?.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (getLang() !== 'de') await setLang('de');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();