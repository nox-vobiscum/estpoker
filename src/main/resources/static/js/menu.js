/* menu.js v27 — seq tooltips (robust), seq change wiring, live i18n, toggle button */
(() => {
  'use strict';
  // Debug/Verify in console: window.__epMenuVer → v27
  window.__epMenuVer = 'v27';
  console.info('[menu] v27 loaded');

  // ---------- tiny DOM helpers ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- refs ----------
  const overlay   = $('#appMenuOverlay');
  const panel     = overlay ? $('.menu-panel', overlay) : null;
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

  const closeBtn  = $('#closeRoomBtn');

  // ---------- utils ----------
  const isMenuOpen = () => overlay && !overlay.classList.contains('hidden');

  const getLang = () =>
    (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

  function setMenuButtonState(open) {
    if (!btnOpen) return;
    btnOpen.textContent = open ? '✕' : '☰';
    // ARIA label only (no tooltip for menu button per rules)
    const de = getLang() === 'de';
    btnOpen.setAttribute('aria-expanded', open ? 'true' : 'false');
    btnOpen.setAttribute('aria-label', open ? (de ? 'Menü schließen' : 'Close menu')
                                            : (de ? 'Menü öffnen'   : 'Open menu'));
  }

  function forceRowLayout() {
    // Enforce grid layout for full-width switch rows (guards against stale CSS caches)
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
      // Ensure no tooltip on the close tile (avoid overflow issues)
      closeBtn.removeAttribute('data-tooltip');
    }
  }

  // ---------- open/close ----------
  function openMenu() {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    setMenuButtonState(true);
    forceRowLayout();
  }
  function closeMenu() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    setMenuButtonState(false);
    btnOpen?.focus?.();
  }
  btnOpen?.addEventListener('click', () => (isMenuOpen() ? closeMenu() : openMenu()));
  backdrop?.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMenuOpen()) closeMenu(); });

  // ---------- language/i18n ----------
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
    // Text nodes
    $$('[data-i18n]', root).forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && map[key] != null) el.textContent = map[key];
    });
    // Attributes
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

  function setLangTooltip(code) {
    // Tooltip text explains switching to the other language
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
      // keep menu button labels in sync with language
      setMenuButtonState(isMenuOpen());
    } catch (err) {
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
      setLangTooltip(to);
      setMenuButtonState(isMenuOpen());
    }
  }

  rowLang?.addEventListener('click', () => {
    const next = getLang() === 'de' ? 'en' : 'de';
    switchLanguage(next);
  });

  // ---------- theme (light/dark/system) ----------
  function applyTheme(mode) {
    try {
      if (mode === 'system') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', mode);
      }
      localStorage.setItem('ep-theme', mode);
      // reflect pressed state
      const setPressed = (btn, on) => btn && btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      setPressed(themeLight,  mode === 'light');
      setPressed(themeDark,   mode === 'dark');
      setPressed(themeSystem, mode === 'system');
    } catch (e) {}
  }
  themeLight?.addEventListener('click',  () => applyTheme('light'));
  themeDark?.addEventListener('click',   () => applyTheme('dark'));
  themeSystem?.addEventListener('click', () => applyTheme('system'));

  // ---------- switches (full-row clickable) ----------
  function wireSwitchRow(rowEl, inputEl, onChange) {
    if (!rowEl || !inputEl) return;
    rowEl.addEventListener('click', (e) => {
      if (e.target === inputEl || e.target.closest('input') === inputEl) return;
      if (inputEl.disabled) return;
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

  // ---------- sequences: tooltips + change ----------
  const SPECIALS = new Set(['?', '❓', '💬', '☕', '∞']);

  // Static fallbacks — used if backend lookup is unavailable
  const SEQ_FALLBACKS = {
    'fib.scrum': [1, 2, 3, 5, 8, 13, 20, 40, 100],
    'fib.enh'  : [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '∞', '❓', '☕'],
    'fib.math' : [1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
    'pow2'     : [2, 4, 8, 16, 32, 64, 128],
    'tshirt'   : ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  };

  // Normalize ids so 'fib.scrum', 'fib-scrum', 'FIB_SCRUM' all match
  const normKey = (s) => String(s || '').replace(/[\s._-]+/g, '').toLowerCase();

  function previewFromArray(arr) {
    // Build "a, b, c, d, e, f,..." preview; filter out specials for numeric sets
    const cleaned = (Array.isArray(arr) ? arr : []).filter(x => !SPECIALS.has(String(x)));
    const firstSix = cleaned.slice(0, 6).map(String);
    if (firstSix.length === 0) return '...';
    return `${firstSix.join(', ')},...`;
  }

  async function fetchSequences() {
    // Try likely endpoints; return robust normalized map; fall back to static
    const candidates = ['/sequences', '/sequences/list'];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) continue;
        const data = await res.json();

        // Normalize into { normalizedId: cards[] }
        const out = new Map();

        if (Array.isArray(data)) {
          // Shape: [{ id, cards }] (accept various property names)
          data.forEach(it => {
            const id = it?.id || it?.name || it?.sequenceId;
            const cards = it?.cards || it?.values || it?.deck;
            if (!id || !Array.isArray(cards)) return;
            out.set(normKey(id), cards);
          });
        } else if (data && typeof data === 'object') {
          // Shape: { "fib.scrum": [...] , ... }
          Object.keys(data).forEach(k => {
            const v = data[k];
            if (Array.isArray(v)) out.set(normKey(k), v);
          });
        }

        if (out.size) return out;
      } catch (e) {
        // keep trying next candidate
      }
    }

    // Fallback: return normalized Map from static object
    const m = new Map();
    Object.keys(SEQ_FALLBACKS).forEach(k => m.set(normKey(k), SEQ_FALLBACKS[k]));
    return m;
  }

  async function initSequenceTooltips() {
    if (!seqRoot) return;
    const seqMap = await fetchSequences();

    // Attach tooltip with first six values for each radio-row label
    $$('label.radio-row', seqRoot).forEach(label => {
      const input = $('input[type="radio"]', label);
      if (!input) return;

      // Try multiple candidates to be resilient to value formats
      const candidates = [
        input.value,
        input.value.replace(/\./g, '-'),
        input.value.replace(/-/g, '.'),
        input.value.replace(/[.\-_]/g, '')
      ];

      let arr = null;
      for (const cand of candidates) {
        const v = seqMap.get(normKey(cand));
        if (v && v.length) { arr = v; break; }
      }

      // Final fallback: direct static lookup
      if (!arr) {
        const v = SEQ_FALLBACKS[input.value];
        if (v && v.length) arr = v;
      }

      if (arr && arr.length) {
        label.setAttribute('data-tooltip', previewFromArray(arr));
      } else {
        // Avoid showing a bare "..." bubble if we cannot resolve
        label.removeAttribute('data-tooltip');
      }
    });

    // Wire change => emit custom event with selected id
    seqRoot.addEventListener('change', (e) => {
      const r = e.target && e.target.closest('input[type="radio"][name="menu-seq"]');
      if (!r) return;
      const id = r.value;
      document.dispatchEvent(new CustomEvent('ep:sequence-change', { detail: { id } }));
    });
  }

  // ---------- init ----------
  (function init() {
    const savedTheme = localStorage.getItem('ep-theme');
    if (savedTheme) applyTheme(savedTheme);

    const lang = getLang();
    setFlagsFor(lang);
    if (langLabel) langLabel.textContent = (lang === 'de') ? 'Deutsch' : 'English';
    stripLangParamFromUrl();
    setLangTooltip(lang);

    setMenuButtonState(false); // initial closed
    if (isMenuOpen()) setMenuButtonState(true);

    forceRowLayout();
    initSequenceTooltips();
  })();
})();
