/* menu.js v26 — full-row switches + live i18n (no ?lang=) + sequence tooltips (all) */
(() => {
  'use strict';
  // Debug/Verify in console: window.__epMenuVer -> 'v26'
  window.__epMenuVer = 'v26';
  console.info('[menu] v26 loaded');

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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

  const closeBtn  = $('#closeRoomBtn');

  // ---------- helpers ----------
  const isMenuOpen = () => overlay && !overlay.classList.contains('hidden');
  const getLang = () =>
    (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

  function setMenuButtonState(open) {
    if (!btnOpen) return;
    // Toggle icon and ARIA (no tooltip by project rule)
    btnOpen.textContent = open ? '✕' : '☰';
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
    }
  }

  // ---------- Open/Close ----------
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

  // Toggle on the same floating button
  btnOpen?.addEventListener('click', () => (isMenuOpen() ? closeMenu() : openMenu()));
  backdrop?.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMenuOpen()) closeMenu(); });

  // ---------- Language ----------
  function setFlagsFor(code) {
    if (!flagA || !flagB) return;
    if (code === 'de') { flagA.src = '/flags/de.svg'; flagB.src = '/flags/at.svg'; }
    else { flagA.src = '/flags/us.svg'; flagB.src = '/flags/gb.svg'; }
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
    // text nodes
    $$('[data-i18n]', root).forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && map[key] != null) el.textContent = map[key];
    });
    // attributes (attr:key;attr:key;…)
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
      setMenuButtonState(isMenuOpen());
    } catch (err) {
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
      setMenuButtonState(isMenuOpen());
    }
  }

  rowLang?.addEventListener('click', () => {
    const next = getLang() === 'de' ? 'en' : 'de';
    switchLanguage(next);
  });

  // ---------- Switch rows (full row clickable) ----------
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

  wireSwitchRow(rowAuto,  swAuto,  (on) => document.dispatchEvent(new CustomEvent('ep:auto-reveal-toggle',  { detail: { on } })));
  wireSwitchRow(rowTopic, swTopic, (on) => document.dispatchEvent(new CustomEvent('ep:topic-toggle',        { detail: { on } })));
  wireSwitchRow(rowPart,  swPart,  (on) => document.dispatchEvent(new CustomEvent('ep:participation-toggle',{ detail: { estimating: on } })));

  closeBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('ep:close-room'));
  });

  // ---------- Sequence tooltips (first 6 values, then ",…") ----------
  const SPECIALS = new Set(['❓','💬','☕']);
  let seqCache = null;

  // Fallback (kept minimal but representative; used if /sequences unavailable)
  const SEQ_FALLBACK = {
    'fib.scrum': [0, 1, 2, 3, 5, 8, 13, 20, 40, 100, '❓', '☕'],
    'fib.enh'  : [0, 1, 2, 3, 5, 8, 13, 20, 40, 100, '∞', '❓', '☕'],
    'fib.math' : [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, '❓', '☕'],
    'pow2'     : [1, 2, 4, 8, 16, 32, 64, '❓', '☕'],
    'tshirt'   : ['XS','S','M','L','XL','XXL','❓','☕'],
  };

  async function getSequencesMap() {
    if (seqCache) return seqCache;
    try {
      const res = await fetch('/sequences', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const map = {};

      // Accept object map or array payloads
      if (Array.isArray(data)) {
        // Expect objects like { id, cards } or { id, values }
        data.forEach(item => {
          const id = item?.id || item?.name;
          const arr = item?.cards || item?.values || item?.deck;
          if (id && Array.isArray(arr)) map[id] = arr.slice();
        });
      } else if (data && typeof data === 'object') {
        // Keys are ids, values are arrays
        Object.keys(data).forEach(k => {
          if (Array.isArray(data[k])) map[k] = data[k].slice();
        });
      }

      // If backend didn’t provide anything useful, fall back
      seqCache = Object.keys(map).length ? map : SEQ_FALLBACK;
    } catch (e) {
      console.warn('[menu] /sequences fetch failed — using fallback', e);
      seqCache = SEQ_FALLBACK;
    }
    return seqCache;
  }

  function previewList(arr) {
    // Show first six non-special values; keep order
    const base = (arr || []).filter(v => !SPECIALS.has(String(v)));
    return base.slice(0, 6).map(v => String(v));
  }

  async function populateSeqTooltips() {
    const seqs = await getSequencesMap();
    $$('label.radio-row[data-seq-id]').forEach(label => {
      const id = label.getAttribute('data-seq-id');
      const deck = seqs[id] || [];
      const preview = previewList(deck);
      if (preview.length) {
        label.setAttribute('data-tooltip', preview.join(' · ') + ',…');
      } else {
        // Gracefully remove placeholder to avoid empty bubbles
        label.removeAttribute('data-tooltip');
      }
    });
  }

  // ---------- Init ----------
  (function init() {
    const lang = getLang();
    setFlagsFor(lang);
    if (langLabel) langLabel.textContent = (lang === 'de') ? 'Deutsch' : 'English';
    stripLangParamFromUrl();
    setMenuButtonState(false); // initially closed
    if (isMenuOpen()) setMenuButtonState(true);
    forceRowLayout();
    // Fill sequence tooltips
    populateSeqTooltips();
  })();
})();
