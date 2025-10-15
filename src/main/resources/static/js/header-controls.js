// /static/js/header-controls.js
(function () {
  'use strict';

  const root = document.documentElement;
  const LS = window.localStorage;

  /* ======================= THEME ======================= */
  const normalizeTheme = (m) => (['light', 'dark', 'system'].includes(m) ? m : 'system');
  const getTheme = () =>
    normalizeTheme(
      LS.getItem('estpoker-theme') ||
      LS.getItem('ep-theme') ||
      LS.getItem('theme') ||
      LS.getItem('themeMode') ||
      (root.getAttribute('data-theme') || 'system')
    );

  // Persist to all known keys + reflect on <html data-theme>
  const setTheme = (mode) => {
    const m = normalizeTheme(mode);
    if (m === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', m);

    // keep every consumer in sync (menu.js reads estpoker-theme/ep-theme)
    try {
      LS.setItem('estpoker-theme', m);
      LS.setItem('ep-theme', m);
      LS.setItem('theme', m);
      LS.setItem('themeMode', m);
    } catch (_) {}

    reflectThemeUI(m);
    // let others (menu.js, etc.) react
    try { window.dispatchEvent(new CustomEvent('est:theme-change', { detail: { mode: m, source: 'header' } })); } catch (_) {}
    return m;
  };

  function reflectThemeUI(mode) {
    const ids = ['hcThemeLight', 'hcThemeDark', 'hcThemeSystem'];
    ids.forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (!btn.dataset.mode) {
        if (id.endsWith('Light')) btn.dataset.mode = 'light';
        else if (id.endsWith('Dark')) btn.dataset.mode = 'dark';
        else btn.dataset.mode = 'system';
      }
      const on = btn.dataset.mode === mode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = `Theme: ${btn.dataset.mode}`;
      btn.setAttribute('aria-label', btn.title);
    });
  }

  /* ======================= LANGUAGE ======================= */
  const normalizeLang = (l) => (l === 'de' || l === 'en') ? l : 'en';
  const getLang = () => normalizeLang(LS.getItem('lang') || root.getAttribute('lang') || 'en');

  // Persist + reflect; prefer central API (menu.js) if present
  const setLang = (lang) => {
    const l = normalizeLang(lang);
    try { LS.setItem('lang', l); } catch (_) {}
    root.setAttribute('lang', l);
    if (typeof window.setLanguage === 'function') {
      try { window.setLanguage(l); } catch (_) {}
    } else {
      try { window.dispatchEvent(new CustomEvent('est:lang-change', { detail: { lang: l, source: 'header' } })); } catch (_) {}
    }
    reflectLangUI(l);
    return l;
  };

  function setFlagPair(containerEl, lang) {
    if (!containerEl) return;
    const a = containerEl.querySelector('.flag-a');
    const b = containerEl.querySelector('.flag-b');
    const pair = (lang === 'de') ? ['de', 'at'] : ['gb', 'us']; // EN = GB/US, DE = DE/AT
    if (a) { a.src = `/flags/${pair[0]}.svg`; a.alt = ''; }
    if (b) { b.src = `/flags/${pair[1]}.svg`; b.alt = ''; }
  }

  function reflectLangUI(lang) {
    const enBtn = document.getElementById('hcLangEN');
    const deBtn = document.getElementById('hcLangDE');
    const isDE = lang === 'de';

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

  /* ======================= INIT ======================= */
  function init() {
    // Theme buttons
    const themeLight  = document.getElementById('hcThemeLight');
    const themeDark   = document.getElementById('hcThemeDark');
    const themeSystem = document.getElementById('hcThemeSystem');

    // Language buttons
    const langEN = document.getElementById('hcLangEN');
    const langDE = document.getElementById('hcLangDE');

    // Initialize theme from persisted value(s)
    reflectThemeUI(setTheme(getTheme()));

    themeLight?.addEventListener('click',  () => setTheme('light'));
    themeDark?.addEventListener('click',   () => setTheme('dark'));
    themeSystem?.addEventListener('click', () => setTheme('system'));

    // Initialize language and wire clicks
    reflectLangUI(setLang(getLang()));
    langEN?.addEventListener('click', () => { if (getLang() !== 'en') setLang('en'); });
    langDE?.addEventListener('click', () => { if (getLang() !== 'de') setLang('de'); });

    // Keep header in sync when something else changes it
    window.addEventListener('est:lang-change', (e) => {
      const next = normalizeLang(e?.detail?.lang || e?.detail?.to || getLang());
      reflectLangUI(next);
    });
    window.addEventListener('est:theme-change', (e) => {
      const next = normalizeTheme(e?.detail?.mode || getTheme());
      reflectThemeUI(next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
