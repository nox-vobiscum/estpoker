/* menu.js v27 — immediate aria-checked, initial disabled radios, theme tooltips */
(() => {
  'use strict';
  window.__epMenuVer = 'v27';
  console.info('[menu] v27 loaded');

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const overlay   = $('#appMenuOverlay');
  const btnOpen   = $('#menuButton');
  const backdrop  = overlay ? $('.menu-backdrop', overlay) : null;
  const rowLang   = $('#langRow');
  const langLabel = $('#langCurrent');
  const flagA     = rowLang ? $('.flag-a', rowLang) : null;
  const flagB     = rowLang ? $('.flag-b', rowLang) : null;

  const rowAuto   = $('#rowAutoReveal');
  const swAuto    = $('#menuAutoRevealToggle');
  const rowTopic  = $('#rowTopic');
  const swTopic   = $('#menuTopicToggle');
  const rowPart   = $('#rowParticipation');
  const swPart    = $('#menuParticipationToggle');

  const seqRoot   = $('#menuSeqChoice');

  const themeLight  = $('#themeLight');
  const themeDark   = $('#themeDark');
  const themeSystem = $('#themeSystem');
  const closeBtn    = $('#closeRoomBtn');

  const isMenuOpen = () => overlay && !overlay.classList.contains('hidden');
  const getLang = () =>
    (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

  function setMenuButtonState(open) {
    if (!btnOpen) return;
    btnOpen.textContent = open ? '✕' : '☰';
    const de = getLang() === 'de';
    btnOpen.setAttribute('aria-expanded', open ? 'true' : 'false');
    btnOpen.setAttribute('aria-label', open ? (de ? 'Menü schließen' : 'Close menu')
                                            : (de ? 'Menü öffnen'   : 'Open menu'));
  }

  function forceRowLayout() {
    $$('.menu-item.switch').forEach((row) => {
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '28px 1fr max-content';
      row.style.alignItems = 'center';
      row.style.width = '100%';
    });
    if (closeBtn) {
      closeBtn.style.display = 'grid';
      closeBtn.style.gridTemplateColumns = '28px 1fr';
      const text = closeBtn.querySelector('.truncate-1');
      if (text) {
        text.style.whiteSpace = 'nowrap';
        text.style.overflow = 'hidden';
        text.style.textOverflow = 'ellipsis';
      }
    }
  }

  function openMenu(){ if (!overlay) return; overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false'); setMenuButtonState(true); forceRowLayout(); }
  function closeMenu(){ if (!overlay) return; overlay.classList.add('hidden');    overlay.setAttribute('aria-hidden','true');  setMenuButtonState(false); btnOpen?.focus?.(); }
  btnOpen?.addEventListener('click', () => (isMenuOpen() ? closeMenu() : openMenu()));
  backdrop?.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMenuOpen()) closeMenu(); });

  /* ---------- i18n ---------- */
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
    } catch (e) { console.warn('[menu] stripLangParam failed', e); }
  }
  function applyMessages(map, root = document) {
    $$('[data-i18n]', root).forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && map[key] != null) el.textContent = map[key];
    });
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

  // Theme button tooltips (non-empty for tests)
  function setThemeTooltips(code) {
    const T = (code === 'de')
      ? { light: 'Helles Design', dark: 'Dunkles Design', system: 'Systemthema' }
      : { light: 'Light theme',   dark: 'Dark theme',     system: 'System theme' };
    themeLight?.setAttribute('data-tooltip',  T.light);
    themeDark?.setAttribute('data-tooltip',   T.dark);
    themeSystem?.setAttribute('data-tooltip', T.system);
  }

  function setLangTooltip(code) {
    if (!rowLang) return;
    if (code === 'de') {
      rowLang.setAttribute('data-tooltip', 'Sprache: Deutsch → zu Englisch wechseln');
    } else {
      rowLang.setAttribute('data-tooltip', 'Language: English → switch to German');
    }
  }

  async function switchLanguage(to) {
    try {
      document.documentElement.lang = to;
      setFlagsFor(to);
      if (langLabel) langLabel.textContent = (to === 'de') ? 'Deutsch' : 'English';
      const messages = await fetchMessages(to);
      applyMessages(messages, document);
      stripLangParamFromUrl();
      setLangTooltip(to);
      setThemeTooltips(to);            // NEW: keep theme tooltips localized & present
      setMenuButtonState(isMenuOpen());
    } catch (err) {
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
      setLangTooltip(to);
      setThemeTooltips(to);
      setMenuButtonState(isMenuOpen());
    }
  }
  rowLang?.addEventListener('click', () => {
    const next = getLang() === 'de' ? 'en' : 'de';
    switchLanguage(next);
  });

  /* ---------- theme ---------- */
  function applyTheme(mode) {
    try {
      if (mode === 'system') document.documentElement.removeAttribute('data-theme');
      else                   document.documentElement.setAttribute('data-theme', mode);
      localStorage.setItem('ep-theme', mode);
      const setPressed = (btn, on) => btn && btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      setPressed(themeLight,  mode === 'light');
      setPressed(themeDark,   mode === 'dark');
      setPressed(themeSystem, mode === 'system');
    } catch {}
  }
  themeLight?.addEventListener('click',  () => applyTheme('light'));
  themeDark?.addEventListener('click',   () => applyTheme('dark'));
  themeSystem?.addEventListener('click', () => applyTheme('system'));

  /* ---------- switches: full-row clickable ---------- */
  function reflectAriaChecked(inputEl) {
    if (!inputEl) return;
    inputEl.setAttribute('aria-checked', inputEl.checked ? 'true' : 'false');
  }
  function wireSwitchRow(rowEl, inputEl, onChange) {
    if (!rowEl || !inputEl) return;
    rowEl.addEventListener('click', (e) => {
      if (e.target === inputEl || e.target.closest('input') === inputEl) return;
      if (inputEl.disabled) return;
      inputEl.checked = !inputEl.checked;
      reflectAriaChecked(inputEl);  // NEW: immediate aria reflection
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    inputEl.addEventListener('change', () => {
      reflectAriaChecked(inputEl);  // NEW: also on native change
      onChange?.(!!inputEl.checked);
    });
    // initial aria reflection
    reflectAriaChecked(inputEl);
  }
  wireSwitchRow(rowAuto,  swAuto,  (on) => document.dispatchEvent(new CustomEvent('ep:auto-reveal-toggle', { detail: { on } })));
  wireSwitchRow(rowTopic, swTopic, (on) => document.dispatchEvent(new CustomEvent('ep:topic-toggle',       { detail: { on } })));
  wireSwitchRow(rowPart,  swPart,  (on) => document.dispatchEvent(new CustomEvent('ep:participation-toggle',{ detail: { estimating: on } })));

  closeBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('ep:close-room'));
  });

  /* ---------- sequences: tooltips + change ---------- */
  const SPECIALS = new Set(['?', '❓', '💬', '☕', '∞']);
  const SEQ_FALLBACKS = {
    'fib.scrum': [0, 1, 2, 3, 5, 8, 13, 20, 40, 100],
    'fib.enh'  : [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '∞', '❓', '☕'],
    'fib.math' : [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
    'pow2'     : [2, 4, 8, 16, 32, 64, 128],
    'tshirt'   : ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  };
  function previewFromArray(arr) {
    const cleaned = (Array.isArray(arr) ? arr : []).filter(x => !SPECIALS.has(String(x)));
    const firstSix = cleaned.slice(0, 6).map(String);
    if (firstSix.length === 0) return '...';
    return `${firstSix.join(', ')},...`;
  }
  async function fetchSequences() {
    const candidates = ['/sequences', '/sequences/list'];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data)) {
          const map = {};
          data.forEach(it => {
            const id = it?.id || it?.name || it?.sequenceId;
            const cards = it?.cards || it?.values || it?.deck;
            if (id && Array.isArray(cards)) map[id] = cards;
          });
          if (Object.keys(map).length) return map;
        } else if (data && typeof data === 'object') {
          return data;
        }
      } catch {}
    }
    return SEQ_FALLBACKS;
  }

  async function initSequenceTooltips() {
    if (!seqRoot) return;

    // NEW: default all radios to disabled until room.js enables them for host
    $$('input[type="radio"][name="menu-seq"]', seqRoot).forEach(r => {
      r.disabled = true;
      r.closest('label')?.classList.add('disabled');
    });

    const seqMap = await fetchSequences();
    $$('label.radio-row', seqRoot).forEach(label => {
      const input = $('input[type="radio"]', label);
      if (!input) return;
      const id = input.value;
      const arr = seqMap[id] || SEQ_FALLBACKS[id] || [];
      label.setAttribute('data-tooltip', previewFromArray(arr));
    });

    seqRoot.addEventListener('change', (e) => {
      const r = e.target && e.target.closest('input[type="radio"][name="menu-seq"]');
      if (!r || r.disabled) return; // ignore when not host
      const id = r.value;
      document.dispatchEvent(new CustomEvent('ep:sequence-change', { detail: { id } }));
    });
  }

  /* ---------- init ---------- */
  (function init() {
    const savedTheme = localStorage.getItem('ep-theme');
    if (savedTheme) applyTheme(savedTheme);

    const lang = getLang();
    setFlagsFor(lang);
    if (langLabel) langLabel.textContent = (lang === 'de') ? 'Deutsch' : 'English';
    stripLangParamFromUrl();
    setLangTooltip(lang);
    setThemeTooltips(lang);         // NEW: ensure present for tests

    setMenuButtonState(false);
    if (isMenuOpen()) setMenuButtonState(true);

    forceRowLayout();
    initSequenceTooltips();
  })();
})();
