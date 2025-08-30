/* menu.js v22 — overlay, full-row switches, split-flags, live i18n (ohne Reload) */
(() => {
  'use strict';
  const TAG = '[MENU]';
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  // --- elements -------------------------------------------------------------
  const btn      = $('#menuButton');
  const overlay  = $('#appMenuOverlay');
  const panel    = overlay && overlay.querySelector('.menu-panel');
  const backdrop = overlay && overlay.querySelector('.menu-backdrop');

  // rows
  const rowAuto  = $('#rowAutoReveal');
  const rowTopic = $('#rowTopic');
  const rowPart  = $('#rowParticipation');

  // switches + labels
  const swAuto   = $('#menuAutoRevealToggle');
  const swTopic  = $('#menuTopicToggle');
  const swPart   = $('#menuParticipationToggle');

  const stAuto   = $('#menuArStatus');
  const stTopic  = $('#menuTopicStatus');
  const stPart   = $('#menuPartStatus');

  const seqField = $('#menuSeqChoice');
  const closeBtn = $('#closeRoomBtn');

  // language row
  const langRow  = $('#langRow');
  const langCur  = $('#langCurrent');
  const flagA    = langRow?.querySelector('.flag-a');
  const flagB    = langRow?.querySelector('.flag-b');

  // --- helpers --------------------------------------------------------------
  function open() {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    btn?.setAttribute('aria-expanded', 'true');
    // Focus the panel for ESC handling
    panel?.focus?.();
    enforceFullWidthSwitchRows();
  }
  function close() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    btn?.setAttribute('aria-expanded', 'false');
  }

  // One-line grid enforcement (falls alte CSS im Cache ist)
  function enforceFullWidthSwitchRows() {
    $$('.menu-item.switch').forEach(row => {
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '28px 1fr max-content';
      row.style.alignItems = 'center';
      const input = row.querySelector('input[type="checkbox"]');
      if (input && !input.classList.contains('switch-control')) {
        input.classList.add('switch-control');
      }
      // ganze Zeile klickbar:
      if (!row._clickBound) {
        row._clickBound = true;
        row.addEventListener('click', (e) => {
          // nicht doppelt toggeln, wenn direkt auf dem Input geklickt
          if ((e.target instanceof HTMLInputElement)) return;
          const cb = row.querySelector('input[type="checkbox"]');
          if (!cb || cb.disabled) return;
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    });
  }

  // Status-Labels anhand Schalterzustand neu schreiben (mit Übersetzungen)
  function updateStatusLabels(dict) {
    if (stAuto && swAuto) {
      stAuto.textContent = dict ? (swAuto.checked ? dict['toggle.on'] : dict['toggle.off'])
                                : (swAuto.checked ? 'On' : 'Off');
    }
    if (stTopic && swTopic) {
      stTopic.textContent = dict ? (swTopic.checked ? dict['toggle.on'] : dict['toggle.off'])
                                 : (swTopic.checked ? 'On' : 'Off');
    }
    if (stPart && swPart) {
      stPart.textContent = dict
        ? (swPart.checked ? dict['participation.imIn'] : dict['participation.observer'])
        : (swPart.checked ? "I'm estimating" : 'Observer');
    }
  }

  // --- i18n: Katalog laden & DOM aktualisieren (ohne Reload) ---------------
  const catalogs = new Map(); // lang -> dict

  function currentLang() {
    const l = (document.documentElement.lang || 'en').toLowerCase();
    return l.startsWith('de') ? 'de' : 'en';
  }

  async function fetchCatalog(lang) {
    if (catalogs.has(lang)) return catalogs.get(lang);
    const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(lang)}`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`i18n HTTP ${res.status}`);
    const json = await res.json();
    catalogs.set(lang, json);
    return json;
  }

  function t(dict, key, el) {
    let s = dict[key];
    if (typeof s !== 'string') return undefined;
    // primitive {0}… Ersetzung per data-i18n-arg*
    for (let i = 0; i < 3; i++) {
      const arg = el?.dataset?.[`i18nArg${i}`];
      if (arg != null) s = s.replace(new RegExp(`\\{${i}\\}`, 'g'), arg);
    }
    return s;
  }

  function applyI18n(dict, lang) {
    // data-i18n (Text)
    $$('.menu-panel [data-i18n], body > * [data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(dict, key, el);
      if (val != null) el.textContent = val;
    });
    // data-i18n-attr (Attribute)
    $$('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr') || '';
      spec.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s && s.trim());
        if (!attr || !key) return;
        const val = t(dict, key, el);
        if (val != null) el.setAttribute(attr, val);
      });
    });

    // html@lang + Flaggen + Label
    document.documentElement.lang = lang;
    if (lang === 'de') {
      if (flagA) flagA.src = '/flags/de.svg';
      if (flagB) flagB.src = '/flags/at.svg';
      if (langCur) langCur.textContent = 'Deutsch';
    } else {
      if (flagA) flagA.src = '/flags/us.svg';
      if (flagB) flagB.src = '/flags/gb.svg';
      if (langCur) langCur.textContent = 'English';
    }

    // Statuslabels nachziehen
    updateStatusLabels(dict);

    // Custom-Event für andere Module (z.B. room.js → syncMenuFromState)
    document.dispatchEvent(new CustomEvent('ep:lang-changed', { detail: { lang } }));
  }

  async function switchLanguage(nextLang) {
    try {
      const dict = await fetchCatalog(nextLang);
      applyI18n(dict, nextLang);
      console.info(TAG, 'language →', nextLang);
    } catch (err) {
      console.error(TAG, 'switchLanguage failed:', err);
    }
  }

  // --- wiring ----------------------------------------------------------------
  function wireLanguageRow() {
    if (!langRow) return;
    // initial Flaggen passend setzen
    const init = currentLang();
    if (init === 'de') { flagA && (flagA.src = '/flags/de.svg'); flagB && (flagB.src = '/flags/at.svg'); langCur && (langCur.textContent = 'Deutsch'); }
    else { flagA && (flagA.src = '/flags/us.svg'); flagB && (flagB.src = '/flags/gb.svg'); langCur && (langCur.textContent = 'English'); }

    const toggleLang = () => switchLanguage(currentLang() === 'de' ? 'en' : 'de');
    on(langRow, 'click', toggleLang);
    on(langRow, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLang(); } });
  }

  function wireOverlay() {
    on(btn, 'click', open);
    on(backdrop, 'click', (e) => { if (e.target.hasAttribute('data-close')) close(); });
    on(document, 'keydown', (e) => { if (e.key === 'Escape') close(); });
    // Kantenfälle: wenn Panel gescrollt und Body fokus verliert etc.
    enforceFullWidthSwitchRows();
  }

  // Switch → Events an room.js delegieren
  on(swAuto,  'change', (e) => document.dispatchEvent(new CustomEvent('ep:auto-reveal-toggle', { detail: { on: !!e.target.checked } })));
  on(swTopic, 'change', (e) => document.dispatchEvent(new CustomEvent('ep:topic-toggle',       { detail: { on: !!e.target.checked } })));
  on(swPart,  'change', (e) => document.dispatchEvent(new CustomEvent('ep:participation-toggle',{ detail: { estimating: !!e.target.checked } })));

  // Sequences
  if (seqField) {
    seqField.querySelectorAll('input[type="radio"][name="menu-seq"]').forEach(r => {
      on(r, 'change', () => {
        if (r.checked) {
          const id = r.value.replace('-', '.'); // safety
          document.dispatchEvent(new CustomEvent('ep:sequence-change', { detail: { id } }));
        }
      });
      // Tooltip für Sequenzen (aus data-tip… am Fieldset)
      const label = r.closest('label');
      if (label && !label.hasAttribute('data-tooltip')) {
        const keyMap = {
          'fib.scrum': 'tipFibScrum',
          'fib.enh':   'tipFibEnh',
          'fib.math':  'tipFibMath',
          'pow2':      'tipPow2',
          'tshirt':    'tipTshirt'
        };
        const dsKey = 'tip' + (keyMap[r.value] ? keyMap[r.value].slice(3) : '');
        const tip = seqField.dataset[keyMap[r.value] || ''] || seqField.dataset[dsKey] || '';
        if (tip) label.setAttribute('data-tooltip', tip);
      }
    });
  }

  // Close room
  on(closeBtn, 'click', () => document.dispatchEvent(new Event('ep:close-room')));

  // Falls Sprache extern geändert wurde → Statuslabels sofort aktualisieren
  on(document, 'ep:lang-changed', () => updateStatusLabels(catalogs.get(currentLang())));

  // Public init
  function init() {
    wireOverlay();
    wireLanguageRow();
    enforceFullWidthSwitchRows();
    updateStatusLabels(); // initial
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
