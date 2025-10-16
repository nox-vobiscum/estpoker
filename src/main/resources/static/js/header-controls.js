// /static/js/header-controls.js  (v9 - header = language-only; theme handled by menu)
(function () {
  'use strict';

  const root = document.documentElement;
  const LS = window.localStorage;

  /* ---------- Theme (no UI here; keep persistence + initial apply) ---------- */
  const getTheme = () => LS.getItem('theme') || LS.getItem('themeMode') || 'system';
  const setThemeLS = (mode) => { LS.setItem('theme', mode); LS.setItem('themeMode', mode); };
  const applyTheme = (mode) => {
    const m = ['light', 'dark', 'system'].includes(mode) ? mode : 'system';
    if (m === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', m);
    setThemeLS(m);
    // Still broadcast so menu / pages react consistently
    try { window.dispatchEvent(new CustomEvent('est:theme-change', { detail: { mode: m, source: 'header' } })); } catch {}
  };

  /* ---------- Language helpers ---------- */
  const norm = (l) => (l === 'de' || l === 'en') ? l : 'en';
  const getLang = () => norm(LS.getItem('lang') || root.getAttribute('lang') || 'en');

  // Tiny formatter: "Hello {0}" / "Hi {name}"
  function fmt(str, params) {
    if (!str || !params) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => {
      if (Object.prototype.hasOwnProperty.call(params, k)) return params[k];
      const i = Number(k);
      return Number.isFinite(i) && params[i] != null ? params[i] : `{${k}}`;
    });
  }

  // Apply an i18n map to data-i18n, data-i18n-attr and data-i18n-dyn
  function applyI18nMap(map) {
    if (!map) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && map[key] != null) el.textContent = map[key];
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr') || '';
      spec.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s?.trim());
        if (attr && key && map[key] != null) el.setAttribute(attr, map[key]);
      });
    });
    document.querySelectorAll('[data-i18n-dyn]').forEach(el => {
      const key = el.getAttribute('data-i18n-dyn');
      const tmpl = key ? map[key] : null;
      if (!tmpl) return;
      const params = {};
      Object.entries(el.dataset).forEach(([k, v]) => {
        if (/^arg\d+$/.test(k)) params[Number(k.slice(3))] = v;
        else if (k !== 'i18nDyn') params[k] = v;
      });
      el.innerHTML = fmt(tmpl, params);
    });
  }

  // Fetch + apply i18n locally; also updates <html lang> and LS
  async function setLang(lang) {
    const l = norm(lang);
    LS.setItem('lang', l);
    root.setAttribute('lang', l);

    // Optional bridge if present
    try { typeof window.setLanguage === 'function' && window.setLanguage(l); } catch {}

    // Local apply to keep header self-contained
    try {
      const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(l)}`, { credentials: 'same-origin' });
      if (res.ok) applyI18nMap(await res.json());
    } catch {}

    try { window.dispatchEvent(new CustomEvent('est:lang-change', { detail: { lang: l, source: 'header' } })); } catch {}
    return l;
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
  function visibleSegCount(groupEl) {
    if (!groupEl) return 0;
    const segs = groupEl.querySelectorAll('.seg');
    let cnt = 0;
    segs.forEach(seg => {
      const cs = window.getComputedStyle(seg);
      if (cs.display !== 'none' && (seg.offsetWidth > 0 || seg.offsetHeight > 0)) cnt++;
    });
    return cnt;
  }
  function isCompactGroup(groupEl) {
    return visibleSegCount(groupEl) <= 1;
  }
  async function cycleLang() {
    const next = getLang() === 'en' ? 'de' : 'en';
    const l = await setLang(next);
    reflectLangUI(l);
  }

  /* ---------- Init ---------- */
  function init() {
    // Apply persisted theme once at startup (UI lives in menu)
    applyTheme(getTheme());

    const langEN = document.getElementById('hcLangEN');
    const langDE = document.getElementById('hcLangDE');
    const langGroup  = document.getElementById('hcLang');

    // Language: current + listeners
    const l = getLang();
    setLang(l);     // align LS/html and apply i18n on first load
    reflectLangUI(l);

    // Regular per-button behavior (desktop / non-compact)
    langEN?.addEventListener('click', async () => {
      const cur = getLang(); if (cur !== 'en') reflectLangUI(await setLang('en'));
    });
    langDE?.addEventListener('click', async () => {
      const cur = getLang(); if (cur !== 'de') reflectLangUI(await setLang('de'));
    });

    // Compact-mode: single visible segment toggles EN↔DE
    const stop = (e) => { e.preventDefault?.(); e.stopPropagation?.(); };
    function bindCompactCycler(groupEl, onCycle) {
      if (!groupEl) return;
      groupEl.addEventListener('click', (e) => {
        if (!isCompactGroup(groupEl)) return;
        stop(e); onCycle();
      });
      groupEl.addEventListener('keydown', (e) => {
        if (!isCompactGroup(groupEl)) return;
        if (e.key === 'Enter' || e.key === ' ') { stop(e); onCycle(); }
      });
      groupEl.addEventListener('pointerdown', (e) => {
        if (!isCompactGroup(groupEl)) return;
        stop(e);
      }, { passive: false });
    }
    bindCompactCycler(langGroup, cycleLang);

    // Keep in sync if others change it
    window.addEventListener('est:lang-change', (e) => {
      try { reflectLangUI(norm(e?.detail?.lang || e?.detail?.to || getLang())); } catch {}
    });
    // If menu changes theme, still honor it here (no UI reflection needed)
    window.addEventListener('est:theme-change', (e) => {
      try { applyTheme(e?.detail?.mode || getTheme()); } catch {}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
