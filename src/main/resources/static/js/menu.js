/* menu.js v37 — i18n-driven tooltips; native titles; sequence tips; hard/soft toggle; specials toggle
   - Tooltips now prefer messages from /i18n/messages (messages*.properties) with graceful fallbacks.
   - Uses existing labels (aria) from HTML; only enhances titles/tooltips dynamically.
   - Theme persistence: writes both 'estpoker-theme' (legacy) and 'ep-theme'.
*/
(() => {
  'use strict';
  window.__epMenuVer = 'v37';
  console.info('[menu] v37 loaded');

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

  const rowSpecials = $('#rowSpecials');
  const swSpecials  = $('#menuSpecialsToggle');

  const rowHard    = $('#rowHardMode');
  const swHard     = $('#menuHardModeToggle');

  const seqRoot    = $('#menuSeqChoice');

  const themeLight  = $('#themeLight');
  const themeDark   = $('#themeDark');
  const themeSystem = $('#themeSystem');
  const closeBtn    = $('#closeRoomBtn');

  /* ---------- language helpers ---------- */
  const isDe = () => (document.documentElement.lang || 'en').toLowerCase().startsWith('de');
  const getLang = () => (isDe() ? 'de' : 'en');

  /* ---------- i18n store & helpers ---------- */
  const MSG = Object.create(null);

  // Safe formatter for `{0}`, `{name}` placeholders.
  function formatMsg(str, params) {
    if (!str || !params) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => {
      // numeric index or named
      if (params.hasOwnProperty(k)) return params[k];
      const idx = Number(k);
      return Number.isFinite(idx) && params[idx] != null ? params[idx] : `{${k}}`;
    });
  }

  // Read a message key from cache; fall back to provided default if missing.
  function t(key, fallback, params) {
    let s = (key && Object.prototype.hasOwnProperty.call(MSG, key)) ? MSG[key] : undefined;
    if (s == null) s = fallback;
    return params ? formatMsg(s, params) : s;
  }

  async function fetchMessages(code) {
    const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(code)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`i18n HTTP ${res.status}`);
    const data = await res.json();
    if (data && typeof data === 'object') Object.assign(MSG, data);
    return MSG;
  }

  /* ---------- Menu open/close ---------- */
  function setMenuButtonState(open) {
    if (!btnOpen) return;
    btnOpen.textContent = open ? '✕' : '☰';
    const de = isDe();
    // Use short labels from bundles if available
    btnOpen.setAttribute('aria-expanded', open ? 'true' : 'false');
    btnOpen.setAttribute(
      'aria-label',
      open ? t('menu.close', de ? 'Menü schließen' : 'Close menu')
           : t('menu.open',  de ? 'Menü öffnen'   : 'Open menu')
    );
    btnOpen.setAttribute(
      'title',
      open ? t('menu.close', de ? 'Menü schließen' : 'Close menu')
           : t('menu.open',  de ? 'Menü öffnen'   : 'Open menu')
    );
  }
  function forceRowLayout() {
    $$('.menu-item.switch').forEach((row) => {
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '24px 1fr max-content';
      row.style.alignItems = 'center';
      row.style.width = '100%';
      row.style.columnGap = '8px';
    });
    if (closeBtn) {
      closeBtn.style.display = 'grid';
      closeBtn.style.gridTemplateColumns = '24px 1fr';
      closeBtn.style.columnGap = '8px';
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
  const isMenuOpen = () => overlay && !overlay.classList.contains('hidden');
  backdrop?.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMenuOpen()) closeMenu(); });

  /* ---------- i18n → apply to DOM ---------- */
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
    // Apply text content for [data-i18n]
    $$('[data-i18n]', root).forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && map[key] != null) el.textContent = map[key];
    });
    // Apply attributes declared in data-i18n-attr="attr:key;attr:key"
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

  /* ---------- Titles / tooltips ---------- */
  function setThemeTooltips(code) {
    // Prefer dedicated title.* keys, fall back to simple labels.
    const titleLight  = t('title.theme.light',  code === 'de' ? 'Design: Hell'   : 'Theme: Light');
    const titleDark   = t('title.theme.dark',   code === 'de' ? 'Design: Dunkel' : 'Theme: Dark');
    const titleSystem = t('title.theme.system', code === 'de' ? 'Design: System' : 'Theme: System');
    const apply = (btn, text) => { if (btn) { btn.setAttribute('title', text); btn.setAttribute('aria-label', text); } };
    apply(themeLight,  titleLight);
    apply(themeDark,   titleDark);
    apply(themeSystem, titleSystem);
  }

  function setFunctionalTooltips(code) {
    const de = (code === 'de');
    // Prefer bundle keys; keep descriptive fallbacks
    const T = {
      auto : t('hint.autoreveal',    de ? 'Automatisch aufdecken, sobald alle geschätzt haben'
                                        : 'Automatically reveal once everyone voted'),
      topic: t('hint.topic.toggle',  de ? 'Ticket/Story-Zeile ein- oder ausblenden'
                                        : 'Show or hide the Ticket/Story row'),
      specials: t('hint.specials',   de ? 'Spezialkarten erlauben (❓ 💬 ☕)'
                                        : 'Allow special cards (❓ 💬 ☕)'),
      hard : t('hint.hardmode',      de ? 'Nur aufdecken, wenn alle gewählt haben'
                                        : 'Reveal only when everyone voted'),
      part : t('hint.participation', de ? 'Zwischen Schätzer:in und Beobachter:in umschalten'
                                        : 'Toggle between estimator and observer'),
      // For the language row, use title.lang.to with the next language as {0}
      lang : t('title.lang.to',      de ? 'Sprache wechseln → {0}' : 'Switch language → {0}',
                                        {0: de ? 'English' : 'Deutsch'}),
      // For the red close button, prefer room.close.hint for a full sentence
      close: t('room.close.hint',    de ? 'Schließt diesen Raum für alle und kehrt zur Startseite zurück.'
                                        : 'Closes this room for all participants and returns to the start page.')
    };

    rowLang?.setAttribute('title', T.lang);
    rowAuto?.setAttribute('title', T.auto);
    rowTopic?.setAttribute('title', T.topic);
    rowSpecials?.setAttribute('title', T.specials);
    rowHard?.setAttribute('title', T.hard);
    rowPart?.setAttribute('title', T.part);
    if (closeBtn) {
      closeBtn.setAttribute('title', T.close);
      // aria-label stays the short action label from HTML/i18n; title carries the long hint
    }
  }

  function setCloseBtnLabel(code) {
    if (!closeBtn) return;
    const labelEl = closeBtn.querySelector('.truncate-1') || closeBtn;
    labelEl.textContent = t('room.close', code === 'de' ? 'Raum für alle schließen' : 'Close room for everyone');
    labelEl.classList.add('truncate-1');
    labelEl.style.whiteSpace = 'nowrap';
    labelEl.style.overflow = 'hidden';
    labelEl.style.textOverflow = 'ellipsis';
  }

  /* ---------- Language switch ---------- */
  async function switchLanguage(to) {
    try {
      document.documentElement.lang = to;
      setFlagsFor(to);
      if (langLabel) langLabel.textContent = (to === 'de') ? 'Deutsch' : 'English';

      // Load messages, then apply all dynamic bits
      await fetchMessages(to);
      applyMessages(MSG, document);
      stripLangParamFromUrl();

      setThemeTooltips(to);
      setFunctionalTooltips(to);
      setCloseBtnLabel(to);

      forceRowLayout();
      setMenuButtonState(isMenuOpen());
    } catch (err) {
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
      // Even if fetching failed, still update non-i18n-dependent bits
      setThemeTooltips(to);
      setFunctionalTooltips(to);
      setCloseBtnLabel(to);
      forceRowLayout();
      setMenuButtonState(isMenuOpen());
    }
  }

  rowLang?.addEventListener('click', () => {
    const next = getLang() === 'de' ? 'en' : 'de';
    switchLanguage(next);
    try { document.dispatchEvent(new CustomEvent('ep:lang-changed', { detail: { to: next } })); } catch {}
  });

  /* ---------- Theme ---------- */
  function applyTheme(mode) {
    try {
      if (mode === 'system') document.documentElement.removeAttribute('data-theme');
      else                   document.documentElement.setAttribute('data-theme', mode);
      // Persist under both keys (legacy + new)
      localStorage.setItem('estpoker-theme', mode);
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

  /* ---------- Switch rows: full-row clickable ---------- */
  function reflectAriaChecked(inputEl, rowEl) {
    if (!inputEl) return;
    const v = inputEl.checked ? 'true' : 'false';
    inputEl.setAttribute('aria-checked', v);
    if (rowEl) rowEl.setAttribute('aria-checked', v);
    const roleSwitchEl = rowEl?.getAttribute('role') === 'switch' ? rowEl : inputEl.closest('[role="switch"]');
    if (roleSwitchEl && roleSwitchEl !== rowEl) roleSwitchEl.setAttribute('aria-checked', v);
  }
  function wireSwitchRow(rowEl, inputEl, onChange) {
    if (!rowEl || !inputEl) return;
    rowEl.addEventListener('click', (e) => {
      if (e.target === inputEl || e.target.closest('input') === inputEl) return;
      if (inputEl.disabled) return;
      inputEl.checked = !inputEl.checked;
      reflectAriaChecked(inputEl, rowEl);
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    inputEl.addEventListener('change', () => {
      reflectAriaChecked(inputEl, rowEl);
      onChange?.(!!inputEl.checked);
    });
    reflectAriaChecked(inputEl, rowEl);
  }

  wireSwitchRow(rowAuto,     swAuto,     (on) => document.dispatchEvent(new CustomEvent('ep:auto-reveal-toggle', { detail: { on } })));
  wireSwitchRow(rowTopic,    swTopic,    (on) => document.dispatchEvent(new CustomEvent('ep:topic-toggle',       { detail: { on } })));
  wireSwitchRow(rowPart,     swPart,     (on) => document.dispatchEvent(new CustomEvent('ep:participation-toggle',{ detail: { estimating: on } })));
  wireSwitchRow(rowSpecials, swSpecials, (on) => document.dispatchEvent(new CustomEvent('ep:specials-toggle',    { detail: { on } })));
  wireSwitchRow(rowHard,     swHard,     (on) => document.dispatchEvent(new CustomEvent('ep:hard-mode-toggle',   { detail: { on } })));

  closeBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('ep:close-room'));
  });

  /* ---------- Sequence radios: titles + change ---------- */
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

  // Enable/disable radios based on host state (robust against host transfer)
  function radiosSetEnabled(isHost){
    if (!seqRoot) return;
    const inputs = Array.from(seqRoot.querySelectorAll('input[type="radio"][name="menu-seq"]'));
    inputs.forEach(r => {
      r.disabled = !isHost;
      const label = r.closest('label');
      if (label) {
        label.classList.toggle('disabled', !isHost);
        if (!isHost) label.setAttribute('aria-disabled', 'true');
        else label.removeAttribute('aria-disabled');
      }
    });
  }
  function updateSeqRadiosEnabledFromBody(){
    const isHost = document.body.classList.contains('is-host');
    radiosSetEnabled(isHost);
  }
  updateSeqRadiosEnabledFromBody();
  new MutationObserver(updateSeqRadiosEnabledFromBody)
    .observe(document.body, { attributes:true, attributeFilter:['class'] });

  async function initSequenceTooltips() {
    if (!seqRoot) return;

    // Initial disabled until the page decides (avoids test flakiness)
    $$('input[type="radio"][name="menu-seq"]', seqRoot).forEach(r => {
      r.disabled = true;
      r.setAttribute('aria-disabled', 'true');
      r.closest('label')?.classList.add('disabled');
      r.closest('label')?.setAttribute('aria-disabled', 'true');
    });

    const seqMap = await fetchSequences();
    $$('label.radio-row', seqRoot).forEach(label => {
      const input = $('input[type="radio"]', label);
      if (!input) return;
      const id = input.value;
      const arr = seqMap[id] || SEQ_FALLBACKS[id] || [];
      const tip = previewFromArray(arr);
      label.setAttribute('title', tip); // native title for quick preview
    });

    // Re-apply enabled state now that DOM is stable
    updateSeqRadiosEnabledFromBody();

    seqRoot.addEventListener('change', (e) => {
      const r = e.target && e.target.closest('input[type="radio"][name="menu-seq"]');
      if (!r || r.disabled) return;
      const id = r.value;
      document.dispatchEvent(new CustomEvent('ep:sequence-change', { detail: { id } }));
    });
  }

  /* ---------- init ---------- */
  (async function init() {
    // Apply saved theme
    const savedTheme = localStorage.getItem('estpoker-theme') || localStorage.getItem('ep-theme');
    if (savedTheme) applyTheme(savedTheme);

    const code = getLang();
    setFlagsFor(code);
    if (langLabel) langLabel.textContent = (code === 'de') ? 'Deutsch' : 'English';
    stripLangParamFromUrl();

    // Load messages first so we can use them for titles
    try {
      await fetchMessages(code);
      applyMessages(MSG, document);
    } catch (e) {
      console.warn('[menu] initial i18n apply failed', e);
    }

    setThemeTooltips(code);
    setFunctionalTooltips(code);
    setCloseBtnLabel(code);

    setMenuButtonState(false);
    if (isMenuOpen()) setMenuButtonState(true);

    forceRowLayout();
    initSequenceTooltips();
  })();
})();
