/* menu.js v26 — full-row switches + live i18n (no ?lang=) + button toggle + dynamic seq-tooltips */
(() => {
  'use strict';
  // Debug/Verify: Im Browser "window.__epMenuVer" tippen → v26
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
    // Icon
    btnOpen.textContent = open ? '✕' : '☰';
    // ARIA (ohne Tooltip, wie gewünscht)
    const de = getLang() === 'de';
    btnOpen.setAttribute('aria-expanded', open ? 'true' : 'false');
    btnOpen.setAttribute('aria-label', open ? (de ? 'Menü schließen' : 'Close menu')
                                            : (de ? 'Menü öffnen'   : 'Open menu'));
    // Wichtig: KEIN data-tooltip setzen
    btnOpen.removeAttribute('data-tooltip');
  }

  function forceRowLayout() {
    // Erzwinge Grid-Layout für ganze Zeile (falls altes CSS gecacht)
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

  // Toggle auf dem gleichen Button
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

  async function switchLanguage(to) {
    try {
      document.documentElement.lang = to;
      setFlagsFor(to);
      if (langLabel) langLabel.textContent = (to === 'de') ? 'Deutsch' : 'English';
      const messages = await fetchMessages(to);
      applyMessages(messages, document);
      stripLangParamFromUrl();
      setMenuButtonState(isMenuOpen());
      // Nach i18n-Update SEQ-Tooltips erneut bauen (i18n-Fallback könnte überschrieben worden sein)
      queueSeqTooltipUpdate();
    } catch (err) {
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
      setMenuButtonState(isMenuOpen());
      queueSeqTooltipUpdate();
    }
  }

  rowLang?.addEventListener('click', () => {
    const next = getLang() === 'de' ? 'en' : 'de';
    switchLanguage(next);
  });

  // ---------- Switch rows (ganze Zeile klickbar) ----------
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

  // ---------- Dynamic Sequence Tooltips ----------
  const SPECIALS = new Set(['❓','💬','☕','∞']);

  function normalizeList(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(String);
  }

  function firstSixBaseValues(list) {
    const out = [];
    for (const v of list) {
      const s = String(v).trim();
      if (SPECIALS.has(s)) continue;            // Sonderkarten überspringen
      out.push(s);
      if (out.length >= 6) break;
    }
    return out;
  }

  function setSeqTooltipFor(id, text) {
    const label = $(`#menuSeqChoice [data-seq-id="${CSS.escape(id)}"]`);
    if (!label) return;
    if (text && text.trim()) label.setAttribute('data-tooltip', text);
  }

  function buildPreviewText(vals) {
    const six = firstSixBaseValues(vals);
    if (!six.length) return '';
    return six.join(', ') + (vals.length > six.length ? ', ...' : '');
  }

  // Robust Extraktion, mehrere mögliche Antwortformen unterstützen
  function extractCardsForId(data, id) {
    if (!data) return null;

    // Variante A: { "fib.scrum": ["1","2",...], "fib.enh": [...] }
    if (Array.isArray(data[id])) return data[id];

    // Variante B: { sequences: { "fib.scrum": ["1",...], ... } }
    if (data.sequences) {
      if (Array.isArray(data.sequences[id])) return data.sequences[id];
      if (data.sequences[id] && Array.isArray(data.sequences[id].cards)) return data.sequences[id].cards;
    }

    // Variante C: Array von Objekten
    if (Array.isArray(data)) {
      const entry = data.find(x => x && (x.id === id || x.key === id || x.name === id));
      if (entry) {
        if (Array.isArray(entry.cards)) return entry.cards;
        if (Array.isArray(entry.values)) return entry.values;
      }
    }

    return null;
  }

  async function updateSequenceTooltips() {
    try {
      const res = await fetch('/sequences', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      ['fib.scrum','fib.enh','fib.math','pow2','tshirt'].forEach(id => {
        const cards = normalizeList(extractCardsForId(data, id));
        const preview = buildPreviewText(cards);
        if (preview) setSeqTooltipFor(id, preview);
      });
    } catch (e) {
      // Fallback: vorhandene (i18n) Tooltips kürzen auf 6 Werte
      ['fib.scrum','fib.enh','fib.math','pow2','tshirt'].forEach(id => {
        const label = $(`#menuSeqChoice [data-seq-id="${CSS.escape(id)}"]`);
        if (!label) return;
        const raw = label.getAttribute('data-tooltip') || '';
        if (!raw) return;
        // rudimentär nach Komma trennen und kürzen
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        const preview = parts.slice(0, 6).join(', ') + (parts.length > 6 ? ', ...' : '');
        setSeqTooltipFor(id, preview);
      });
    }
  }

  let seqTooltipTimer = null;
  function queueSeqTooltipUpdate() {
    if (seqTooltipTimer) cancelAnimationFrame(seqTooltipTimer);
    seqTooltipTimer = requestAnimationFrame(() => {
      seqTooltipTimer = null;
      updateSequenceTooltips();
    });
  }

  // ---------- Init ----------
  (function init() {
    const lang = getLang();
    setFlagsFor(lang);
    if (langLabel) langLabel.textContent = (lang === 'de') ? 'Deutsch' : 'English';
    stripLangParamFromUrl();
    setMenuButtonState(false); // initial geschlossen
    if (isMenuOpen()) setMenuButtonState(true);
    forceRowLayout();
    queueSeqTooltipUpdate();
  })();
})();
