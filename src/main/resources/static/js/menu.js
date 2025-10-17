/* menu.js v40 — i18n-driven tooltips + dynamic messages (index/invite) + specials palette */
(() => {
  'use strict';
  window.__epMenuVer = 'v40';
  console.info('[menu] v40 loaded');

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
  const rowSpecialsPick = $('#rowSpecialsPick');

  const rowHard    = $('#rowHardMode');
  const swHard     = $('#menuHardModeToggle');

  const seqRoot    = $('#menuSeqChoice');

  const themeLight  = $('#themeLight');
  const themeDark   = $('#themeDark');
  const themeSystem = $('#themeSystem');
  const closeBtn    = $('#closeRoomBtn');

  /* ---------- language helpers ---------- */
  const LANG_KEY = 'lang';
  const normalizeLang = (v) => (String(v || '').toLowerCase().startsWith('de') ? 'de' : 'en');
  const htmlLang = () => (document.documentElement.lang || '').toLowerCase();
  const savedLang = () => (localStorage.getItem(LANG_KEY) || '').toLowerCase();
  const getLang = () => normalizeLang(savedLang() || htmlLang() || 'en');
  const isDe = () => getLang() === 'de';

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
    const labelOpen  = t('menu.open',  'Open menu');
    const labelClose = t('menu.close', 'Close menu');
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
  function openMenu(){
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden','false');
  setMenuButtonState(true);
  forceRowLayout();
  try { document.dispatchEvent(new CustomEvent('ep:menu-open')); } catch {}
}

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

  // dynamic message support: data-i18n-dyn with {0}/{name} placeholders
  function applyDynamicMessages(root = document) {
    $$('[data-i18n-dyn]', root).forEach((el) => {
      const key = el.getAttribute('data-i18n-dyn');
      const tmpl = key ? MSG[key] : null;
      if (!tmpl) return;
      const params = {};
      Object.entries(el.dataset).forEach(([k, v]) => {
        if (/^arg\d+$/.test(k)) params[Number(k.slice(3))] = v;
        else if (k !== 'i18nDyn') params[k] = v;
      });
      el.innerHTML = formatMsg(tmpl, params);
    });
  }

  /* ---------- Titles / tooltips ---------- */
  function setThemeTooltips(code) {
    const titleLight  = t('title.theme.light',  'Theme: Light');
    const titleDark   = t('title.theme.dark',   'Theme: Dark');
    const titleSystem = t('title.theme.system', 'Theme: System');
    const apply = (btn, text) => { if (btn) { btn.setAttribute('title', text); btn.setAttribute('aria-label', text); } };
    apply(themeLight,  titleLight);
    apply(themeDark,   titleDark);
    apply(themeSystem, titleSystem);
  }
  function setFunctionalTooltips(code) {
    const T = {
      auto    : t('hint.autoreveal',   'Automatically reveal once everyone voted'),
      topic   : t('hint.topic.toggle', 'Show or hide the Ticket/Story row'),
      specials: t('hint.specials',     'Allow special cards (❓ 💬 ☕)'),
      hard    : t('hint.hardmode',     'Reveal only when everyone voted'),
      part    : t('hint.participation','Toggle between estimator and spectator'),
      lang    : t('title.lang.to',     'Switch language \u2192 {0}', {0: isDe() ? 'English' : 'Deutsch'}),
      close   : t('room.close.hint',   'Closes this room for all participants and returns to the start page.')
    };
    rowLang?.setAttribute('title', T.lang);
    rowAuto?.setAttribute('title', T.auto);
    rowTopic?.setAttribute('title', T.topic);
    rowSpecials?.setAttribute('title', T.specials);
    rowHard?.setAttribute('title', T.hard);
    rowPart?.setAttribute('title', T.part);
    if (rowSpecialsPick) {
      // Keep a concise title on the palette itself; detailed per-icon tooltips come from data-i18n-attr
      const ttl = t('menu.specials.title', 'Special cards');
      rowSpecialsPick.setAttribute('title', ttl);
      rowSpecialsPick.setAttribute('aria-label', ttl);
    }
    if (closeBtn) closeBtn.setAttribute('title', T.close);
  }
  function setCloseBtnLabel() {
    if (!closeBtn) return;
    const labelEl = closeBtn.querySelector('.truncate-1') || closeBtn;
    labelEl.textContent = t('room.close', 'Close room for everyone');
    labelEl.classList.add('truncate-1');
    labelEl.style.whiteSpace = 'nowrap';
    labelEl.style.overflow = 'hidden';
    labelEl.style.textOverflow = 'ellipsis';
  }

  /* ---------- Specials palette ---------- */
  function specials_getSelectedIds() {
    if (!rowSpecialsPick) return [];
    return Array.from(rowSpecialsPick.querySelectorAll('label.spc input[type="checkbox"]:checked'))
      .map(inp => inp.closest('label.spc')?.dataset.id)
      .filter(Boolean);
  }
  function specials_setSelectedIds(ids) {
    if (!rowSpecialsPick) return;
    const want = new Set((ids || []).map(String));
    rowSpecialsPick.querySelectorAll('label.spc').forEach(lab => {
      const id = lab.dataset.id;
      const inp = lab.querySelector('input[type="checkbox"]');
      if (!inp) return;
      const on = want.has(String(id));
      if (inp.checked !== on) inp.checked = on;
      inp.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  function specials_setPaletteVisible(show) {
    if (!rowSpecialsPick) return;
    rowSpecialsPick.hidden = !show;
    try { rowSpecialsPick.style.display = show ? '' : 'none'; } catch {}
  }


  /* ---------- Language switch (core) ---------- */
  async function switchLanguage(to) {
    const code = normalizeLang(to);
    // Guard: avoid redundant work if already set
    if (normalizeLang(document.documentElement.lang) === code && getLang() === code) {
      return;
    }
    try {
      // persist + reflect
      localStorage.setItem(LANG_KEY, code);
      document.documentElement.lang = code;
      setFlagsFor(code);
      if (langLabel) langLabel.textContent = (code === 'de') ? 'Deutsch' : 'English';

      // load & apply
      await fetchMessages(code);
      applyMessages(MSG, document);
      applyDynamicMessages(document);
      stripLangParamFromUrl();

      // refresh tooltips/labels and layout tweaks
      setThemeTooltips(code);
      setFunctionalTooltips(code);
      setCloseBtnLabel();
      forceRowLayout();
      setMenuButtonState(isMenuOpen());
    } catch (err) {
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
      setThemeTooltips(code);
      setFunctionalTooltips(code);
      setCloseBtnLabel();
      forceRowLayout();
      setMenuButtonState(isMenuOpen());
    }
  }

  // Language toggle from the menu row (if present)
  rowLang?.addEventListener('click', () => {
    const next = getLang() === 'de' ? 'en' : 'de';
    window.setLanguage(next); // public API
    try {
      window.dispatchEvent(new CustomEvent('est:lang-change', { detail: { lang: next, source: 'menu' } }));
    } catch {}
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

  /* ---------- Specials palette (IDs & helpers) ---------- */
  const SPECIALS_ORDER = ['coffee','speech','telescope','waiting','dependency','risk','relevance'];

  function specialsPickVisible(on){
    if (!rowSpecialsPick) return;
    rowSpecialsPick.hidden = !on;
    try { rowSpecialsPick.style.display = on ? '' : 'none'; } catch {}
  }

  function specialsSetEnabled(isHost){
    if (!rowSpecialsPick) return;
    const labels = $$('.spc', rowSpecialsPick);
    labels.forEach(lbl => {
      const input = $('input[type="checkbox"]', lbl);
      if (!input) return;
      input.disabled = !isHost;
      lbl.classList.toggle('disabled', !isHost);
      if (!isHost) lbl.setAttribute('aria-disabled', 'true');
      else lbl.removeAttribute('aria-disabled');
    });
  }
  function updateSpecialsEnabledFromBody(){
    const isHost = document.body.classList.contains('is-host');
    specialsSetEnabled(isHost);
  }

  function reflectSpecialsLabelState(lbl, input){
    const on = !!(input && input.checked);
    lbl?.setAttribute('aria-checked', on ? 'true' : 'false');
    if (on) lbl?.classList.add('on'); else lbl?.classList.remove('on');
  }

  function readSelectedSpecials(){
    if (!rowSpecialsPick) return [];
    const checked = $$('label.spc input[type="checkbox"]:checked', rowSpecialsPick)
      .map(inp => (inp.value || inp.closest('label')?.dataset?.id || '').trim())
      .filter(Boolean);
    // stable sort by SPECIALS_ORDER
    return checked.sort((a,b) => SPECIALS_ORDER.indexOf(a) - SPECIALS_ORDER.indexOf(b));
  }

  function dispatchSpecialsSet(){
    const ids = readSelectedSpecials();
    document.dispatchEvent(new CustomEvent('ep:specials-set', { detail: { ids } }));
  }

  function initSpecialsPalette(){
    if (!rowSpecialsPick) return;
    // initial reflect
    $$('label.spc', rowSpecialsPick).forEach(lbl => {
      const input = $('input[type="checkbox"]', lbl);
      if (!input) return;
      reflectSpecialsLabelState(lbl, input);
      // Click on label toggles checkbox (native), but we guard for host
      lbl.addEventListener('click', (e) => {
        const isHost = document.body.classList.contains('is-host');
        if (!isHost) { e.preventDefault(); e.stopPropagation(); return; }
        // allow native toggle, but let 'change' handler dispatch event
      });
      input.addEventListener('change', () => {
        reflectSpecialsLabelState(lbl, input);
        dispatchSpecialsSet();
      });
    });
    updateSpecialsEnabledFromBody();
    new MutationObserver(updateSpecialsEnabledFromBody)
      .observe(document.body, { attributes:true, attributeFilter:['class'] });

    // initial visibility from specials toggle
    if (swSpecials) {
      const aria = swSpecials.getAttribute('aria-checked');
      const on = aria === 'true' ? true : aria === 'false' ? false : !!swSpecials.checked;
      specialsPickVisible(on);
    }
  }

  // react to specials ON/OFF
  document.addEventListener('ep:specials-toggle', (e) => {
    const on = !!(e?.detail && e.detail.on);
    specialsPickVisible(on);
    // When turning OFF, we broadcast empty selection (server will keep only '?')
    if (!on) document.dispatchEvent(new CustomEvent('ep:specials-set', { detail: { ids: [] } }));
    // When turning ON, we broadcast current selection for immediate sync
    else dispatchSpecialsSet();
  });

  /* ---------- init ---------- */
  (async function init() {
    const savedTheme = localStorage.getItem('estpoker-theme') || localStorage.getItem('ep-theme');
    if (savedTheme) applyTheme(savedTheme);

    const code = getLang();
    localStorage.setItem(LANG_KEY, code);
    document.documentElement.lang = code;
    setFlagsFor(code);
    if (langLabel) langLabel.textContent = (code === 'de') ? 'Deutsch' : 'English';
    stripLangParamFromUrl();

    try {
      await fetchMessages(code);
      applyMessages(MSG, document);
      applyDynamicMessages(document);
    } catch (e) {
      console.warn('[menu] initial i18n apply failed', e);
    }

    setThemeTooltips(code);
    setFunctionalTooltips(code);
    setCloseBtnLabel();

    setMenuButtonState(false);
    if (isMenuOpen()) setMenuButtonState(true);

    forceRowLayout();
    initSequenceTooltips();
    initSpecialsPalette();

    // After init, emit current specials state for consumers that subscribe late
    // (e.g., room.js) — this keeps the UI and server in sync on first open.
    if (swSpecials) {
      const aria = swSpecials.getAttribute('aria-checked');
      const on = aria === 'true' ? true : aria === 'false' ? false : !!swSpecials.checked;
      // palette visibility already set in initSpecialsPalette
      document.dispatchEvent(new CustomEvent('ep:specials-toggle', { detail: { on } }));
      if (on) dispatchSpecialsSet();
    }
  })();

  // ---- public bridge for header-controls.js (single source of truth) ----
  window.setLanguage = (code) => {
    try { return switchLanguage(code); }
    catch(e){ console.warn('[menu] setLanguage failed', e); }
  };
  window.addEventListener('est:lang-change', (e) => {
    try {
      const d = e?.detail || {};
      const to = d.lang || d.to;
      if (to && normalizeLang(to) !== getLang()) window.setLanguage(to);
    } catch (err) {
      console.warn('[menu] est:lang-change handler failed', err);
    }
  });
})();
