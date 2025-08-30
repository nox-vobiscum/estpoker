/* menu.js v25 — full-row switches + seq radios + theme + live i18n (no ?lang=) */
(() => {
  'use strict';
  // Debug/Verify: im Browser "window.__epMenuVer" → v25
  window.__epMenuVer = 'v25';
  console.info('[menu] v25 loaded');

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const overlay  = $('#appMenuOverlay');
  const btnOpen  = $('#menuButton');
  const backdrop = overlay ? $('.menu-backdrop', overlay) : null;

  const rowLang   = $('#langRow');
  const langLabel = $('#langCurrent');
  const flagA     = rowLang ? $('.flag-a', rowLang) : null;
  const flagB     = rowLang ? $('.flag-b', rowLang) : null;

  const themeBtns = {
    light:  $('#themeLight'),
    dark:   $('#themeDark'),
    system: $('#themeSystem')
  };

  const seqField = $('#menuSeqChoice');

  const rowAuto = $('#rowAutoReveal');
  const swAuto  = $('#menuAutoRevealToggle');

  const rowTopic = $('#rowTopic');
  const swTopic  = $('#menuTopicToggle');

  const rowPart = $('#rowParticipation');
  const swPart  = $('#menuParticipationToggle');

  const closeBtn = $('#closeRoomBtn');

  // ---------- Overlay ----------
  function forceRowLayout() {
    // Erzwinge Grid-Layout für Switch-Zeilen (falls altes CSS gecacht)
    $$('.menu-item.switch').forEach((row) => {
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '28px 1fr max-content';
      row.style.alignItems = 'center';
      row.style.width = '100%';
    });
    // Close-Button einzeilig lassen (Kompat)
    if (closeBtn) {
      closeBtn.style.display = 'grid';
      closeBtn.style.gridTemplateColumns = '28px 1fr';
      const text = closeBtn.querySelector('.truncate-1');
      if (text) {
        text.style.whiteSpace = 'nowrap';
        text.style.overflow = 'hidden';
        text.style.textOverflow = 'ellipsis';
        text.style.minWidth = '0';
      }
    }
  }

  function openMenu() {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    btnOpen?.setAttribute('aria-expanded', 'true');
    forceRowLayout();
  }
  function closeMenu() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    btnOpen?.setAttribute('aria-expanded', 'false');
    btnOpen?.focus?.();
  }

  btnOpen?.addEventListener('click', openMenu);
  backdrop?.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close')) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) closeMenu();
  });

  // ---------- Language ----------
  const getLang = () =>
    (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

  function setFlagsFor(code) {
    if (!flagA || !flagB) return;
    if (code === 'de') { flagA.src = '/flags/de.svg'; flagB.src = '/flags/at.svg'; }
    else               { flagA.src = '/flags/us.svg'; flagB.src = '/flags/gb.svg'; }
  }

  function stripLangParamFromUrl() {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has('lang')) {
        u.searchParams.delete('lang');
        const qs = u.searchParams.toString();
        const next = u.pathname + (qs ? '?' + qs : '') + u.hash;
        history.replaceState({}, '', next);
      }
    } catch (e) {
      console.warn('[menu] stripLangParam failed', e);
    }
  }

  function applyMessages(map, root = document) {
    // Texte
    $$('[data-i18n]', root).forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && map[key] != null) el.textContent = map[key];
    });
    // Attribute
    $$('[data-i18n-attr]', root).forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr'); if (!spec) return;
      spec.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s?.trim());
        if (!attr || !key) return;
        const val = map[key];
        if (val != null) el.setAttribute(attr, val);
      });
    });
  }

  async function fetchMessages(code) {
    const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(code)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`i18n HTTP ${res.status}`);
    return res.json();
  }

  async function switchLanguage(to) {
    try {
      document.documentElement.lang = to;
      setFlagsFor(to);
      if (langLabel) langLabel.textContent = (to === 'de') ? 'Deutsch' : 'English';
      const messages = await fetchMessages(to);
      applyMessages(messages, document);
      stripLangParamFromUrl();
    } catch (err) {
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
    }
  }

  rowLang?.addEventListener('click', () => {
    const next = getLang() === 'de' ? 'en' : 'de';
    switchLanguage(next);
  });

  // ---------- Ganze Zeile klickbar für Switches ----------
  function wireSwitchRow(rowEl, inputEl, onChange) {
    if (!rowEl || !inputEl) return;
    rowEl.addEventListener('click', (e) => {
      // Direkter Klick auf Input → Browserdefault
      if (e.target === inputEl || e.target.closest('input') === inputEl) return;
      if (inputEl.disabled || rowEl.classList.contains('disabled')) return;
      inputEl.checked = !inputEl.checked;
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    inputEl.addEventListener('change', () => onChange?.(!!inputEl.checked));
  }

  wireSwitchRow(rowAuto,  swAuto,  (on) => document.dispatchEvent(new CustomEvent('ep:auto-reveal-toggle', { detail: { on } })));
  wireSwitchRow(rowTopic, swTopic, (on) => document.dispatchEvent(new CustomEvent('ep:topic-toggle',       { detail: { on } })));
  wireSwitchRow(rowPart,  swPart,  (on) => document.dispatchEvent(new CustomEvent('ep:participation-toggle',{ detail: { estimating: on } })));

  closeBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('ep:close-room'));
  });

  // ---------- Theme (Light/Dark/System) ----------
  const THEME_KEY = 'ep-theme';

  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'light' || mode === 'dark') {
      root.setAttribute('data-theme', mode);
    } else {
      root.removeAttribute('data-theme'); // folgt System
    }
    try { localStorage.setItem(THEME_KEY, mode); } catch {}
    Object.entries(themeBtns).forEach(([k, btn]) =>
      btn?.setAttribute('aria-pressed', String(k === mode))
    );
  }

  function initTheme() {
    let saved = 'system';
    try { saved = localStorage.getItem(THEME_KEY) || 'system'; } catch {}
    applyTheme(saved);
    // bei System-Änderung live nachziehen
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', () => {
        const pref = (localStorage.getItem(THEME_KEY) || 'system');
        if (pref === 'system') applyTheme('system');
      });
    }
  }

  themeBtns.light?.addEventListener('click',  () => applyTheme('light'));
  themeBtns.dark?.addEventListener('click',   () => applyTheme('dark'));
  themeBtns.system?.addEventListener('click', () => applyTheme('system'));

  // ---------- Sequence radios ----------
  seqField?.addEventListener('change', (e) => {
    const r = e.target;
    if (!(r instanceof HTMLInputElement)) return;
    if (r.name === 'menu-seq' && r.checked) {
      const id = r.value.replace('-', '.'); // tolerant ggü. alter ID-Notation
      document.dispatchEvent(new CustomEvent('ep:sequence-change', { detail: { id } }));
    }
  });

  // ---------- Init ----------
  (function init() {
    const lang = getLang();
    setFlagsFor(lang);
    if (langLabel) langLabel.textContent = (lang === 'de') ? 'Deutsch' : 'English';
    stripLangParamFromUrl();
    forceRowLayout(); // falls Cache alt ist
    initTheme();
  })();
})();
