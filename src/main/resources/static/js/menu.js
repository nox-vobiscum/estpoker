/* menu.js v38 — i18n-driven tooltips + dynamic messages (index/invite) */
(() => {
  'use strict';
  window.__epMenuVer = 'v38';
  console.info('[menu] v38 loaded');

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

  // read lang from <html lang=...> OR persisted localStorage
  const isDe = () => (document.documentElement.lang || localStorage.getItem('lang') || 'en')
  .toLowerCase()
  .startsWith('de');

  const getLang = () => (localStorage.getItem('lang') || (isDe() ? 'de' : 'en'));


  /* ---------- i18n store ---------- */
  const MSG = Object.create(null);

  function formatMsg(str, params) {
    if (!str || !params) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => {
      if (Object.prototype.hasOwnProperty.call(params, k)) return params[k];
      const i = Number(k);
      return Number.isFinite(i) && params[i] != null ? params[i] : `{${k}}`;
    });
  }
  function t(key, fallback, params) {
    let s = (key && Object.prototype.hasOwnProperty.call(MSG, key)) ? MSG[key] : undefined;
    if (s == null) s = fallback;
    return params ? formatMsg(s, params) : s;
  }
  async function fetchMessages(code) {
    const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(code)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`i18n HTTP ${res.status}`);
    Object.assign(MSG, await res.json());
    return MSG;
  }

  /* ---------- open/close ---------- */
  const isMenuOpen = () => overlay && !overlay.classList.contains('hidden');
  function setMenuButtonState(open) {
    if (!btnOpen) return;
    btnOpen.textContent = open ? '✕' : '☰';
    const de = isDe();
    const labelOpen  = t('menu.open',  de ? 'Menü öffnen'   : 'Open menu');
    const labelClose = t('menu.close', de ? 'Menü schließen' : 'Close menu');
    btnOpen.setAttribute('aria-expanded', open ? 'true' : 'false');
    btnOpen.setAttribute('aria-label', open ? labelClose : labelOpen);
    btnOpen.setAttribute('title',       open ? labelClose : labelOpen);
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
  backdrop?.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMenuOpen()) closeMenu(); });

  /* ---------- apply messages to DOM ---------- */
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

  // NEW: dynamic message support for elements with data-i18n-dyn
  function applyDynamicMessages(root = document) {
    $$('[data-i18n-dyn]', root).forEach((el) => {
      const key = el.getAttribute('data-i18n-dyn');
      const tmpl = key ? MSG[key] : null;
      if (!tmpl) return;
      // Collect numbered args: data-arg0, data-arg1, ...
      const params = {};
      Object.entries(el.dataset).forEach(([k, v]) => {
        if (/^arg\d+$/.test(k)) params[Number(k.slice(3))] = v;
        // Also allow named params: any data-* except i18nDyn/argN
        else if (k !== 'i18nDyn') params[k] = v;
      });
      el.innerHTML = formatMsg(tmpl, params);
    });
  }

  /* ---------- Titles / tooltips ---------- */
  function setThemeTooltips(code) {
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
    const T = {
      auto : t('hint.autoreveal',    de ? 'Automatisch aufdecken, sobald alle geschätzt haben' : 'Automatically reveal once everyone voted'),
      topic: t('hint.topic.toggle',  de ? 'Ticket/Story-Zeile ein- oder ausblenden'            : 'Show or hide the Ticket/Story row'),
      specials: t('hint.specials',   de ? 'Spezialkarten erlauben (❓ 💬 ☕)'                   : 'Allow special cards (❓ 💬 ☕)'),
      hard : t('hint.hardmode',      de ? 'Nur aufdecken, wenn alle gewählt haben'             : 'Reveal only when everyone voted'),
      part : t('hint.participation', de ? 'Zwischen Schätzer:in und Beobachter:in umschalten'  : 'Toggle between estimator and spectator'),
      lang : t('title.lang.to',      de ? 'Sprache wechseln → {0}'                             : 'Switch language → {0}', {0: de ? 'English' : 'Deutsch'}),
      close: t('room.close.hint',    de ? 'Schließt diesen Raum für alle und kehrt zur Startseite zurück.' : 'Closes this room for all participants and returns to the start page.')
    };
    rowLang?.setAttribute('title', T.lang);
    rowAuto?.setAttribute('title', T.auto);
    rowTopic?.setAttribute('title', T.topic);
    rowSpecials?.setAttribute('title', T.specials);
    rowHard?.setAttribute('title', T.hard);
    rowPart?.setAttribute('title', T.part);
    if (closeBtn) closeBtn.setAttribute('title', T.close);
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

      await fetchMessages(to);
      applyMessages(MSG, document);
      applyDynamicMessages(document);     // <-- NEW
      stripLangParamFromUrl();

      setThemeTooltips(to);
      setFunctionalTooltips(to);
      setCloseBtnLabel(to);

      forceRowLayout();
      setMenuButtonState(isMenuOpen());
    } catch (err) {
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
      setThemeTooltips(to);
      setFunctionalTooltips(to);
      setCloseBtnLabel(to);
      forceRowLayout();
      setMenuButtonState(isMenuOpen());
    }
    // --- Bridge for header-controls.js -----------------------------------------
    // Allow header-controls to call us directly:
    window.setLanguage = (code) => {
      try { switchLanguage(code); } catch (e) { console.warn('[menu] setLanguage failed', e); }
    };

    // Or listen to a custom event from header-controls:
    window.addEventListener('est:lang-change', (e) => {
      try {
        const d = e?.detail || {};
        const to = d.lang || d.to || (getLang() === 'de' ? 'en' : 'de');
        switchLanguage(to);
      } catch (err) {
        console.warn('[menu] est:lang-change failed', err);
      }
    });

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

  /* ---------- Switch rows ---------- */
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

  /* ---------- Sequence radios ---------- */
  const SPECIALS = new Set(['?', '❓', '☕', '∞']);
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
      label.setAttribute('title', tip);
    });
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
    const savedTheme = localStorage.getItem('estpoker-theme') || localStorage.getItem('ep-theme');
    if (savedTheme) applyTheme(savedTheme);

    const code = getLang();
    document.documentElement.lang = code;
    setFlagsFor(code);
    if (langLabel) langLabel.textContent = (code === 'de') ? 'Deutsch' : 'English';
    stripLangParamFromUrl();

    try {
      await fetchMessages(code);
      applyMessages(MSG, document);
      applyDynamicMessages(document);   // <-- NEW
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
