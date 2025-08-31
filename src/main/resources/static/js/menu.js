/* menu.js v26 — theme switching (light/dark/system) + smarter lang tooltip + full-row switches */
(() => {
  'use strict';
  // Debug/verify in console: window.__epMenuVer -> v26
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

  // Theme buttons
  const btnThemeLight  = $('#themeLight');
  const btnThemeDark   = $('#themeDark');
  const btnThemeSystem = $('#themeSystem');

  // ---------- helpers ----------
  const isMenuOpen = () => overlay && !overlay.classList.contains('hidden');

  const getLang = () =>
    (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

  function setMenuButtonState(open) {
    if (!btnOpen) return;
    // Toggle icon + localized ARIA
    btnOpen.textContent = open ? '✕' : '☰';
    const de = getLang() === 'de';
    btnOpen.setAttribute('aria-expanded', open ? 'true' : 'false');
    // Keep labels but do NOT add tooltips here (project rule: no tooltip on menu button)
    btnOpen.setAttribute('aria-label', open ? (de ? 'Menü schließen' : 'Close menu')
                                            : (de ? 'Menü öffnen'   : 'Open menu'));
  }

  function forceRowLayout() {
    // Enforce full-row grid for switch rows (guards against stale CSS caches)
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

  // Toggle using the same button
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

  function updateLangTooltipForCurrent() {
    if (!rowLang) return;
    const curIsDe = getLang() === 'de';
    // Localized, explicit “switch to …”
    const text = curIsDe
      ? 'Sprache: Deutsch → zu Englisch wechseln'
      : 'Language: English → switch to German';
    rowLang.setAttribute('data-tooltip', text);
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
      updateLangTooltipForCurrent();
    } catch (err) {
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
      setMenuButtonState(isMenuOpen());
      updateLangTooltipForCurrent();
    }
  }

  rowLang?.addEventListener('click', () => {
    const next = getLang() === 'de' ? 'en' : 'de';
    switchLanguage(next);
  });

  // ---------- Theme switching ----------
  const THEME_KEY = 'ep.theme'; // 'light' | 'dark' | 'system'
  let systemMql = window.matchMedia('(prefers-color-scheme: dark)');
  let systemListener = null;

  function currentSystemTheme() {
    return systemMql.matches ? 'dark' : 'light';
  }

  function setThemeAttr(mode) {
    const root = document.documentElement;
    if (mode === 'system') {
      root.setAttribute('data-theme', currentSystemTheme());
      root.setAttribute('data-theme-source', 'system');
      // (Re)attach listener to live-follow system changes
      if (systemListener) systemMql.removeEventListener('change', systemListener);
      systemListener = () => {
        if (localStorage.getItem(THEME_KEY) === 'system') {
          root.setAttribute('data-theme', currentSystemTheme());
          // keep buttons’ pressed states as-is
        }
      };
      systemMql.addEventListener('change', systemListener);
    } else {
      root.setAttribute('data-theme', mode);
      root.removeAttribute('data-theme-source');
      if (systemListener) {
        systemMql.removeEventListener('change', systemListener);
        systemListener = null;
      }
    }
  }

  function setTheme(mode) {
    localStorage.setItem(THEME_KEY, mode);
    setThemeAttr(mode);
    updateThemeButtons(mode);
  }

  function updateThemeButtons(mode) {
    const map = {
      light: btnThemeLight,
      dark: btnThemeDark,
      system: btnThemeSystem
    };
    Object.entries(map).forEach(([key, btn]) => {
      if (!btn) return;
      const active = (key === mode);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  btnThemeLight?.addEventListener('click', () => setTheme('light'));
  btnThemeDark?.addEventListener('click', () => setTheme('dark'));
  btnThemeSystem?.addEventListener('click', () => setTheme('system'));

  // ---------- Switch rows (full-row click) ----------
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

  // ---------- Init ----------
  (function init() {
    // Language
    const lang = getLang();
    setFlagsFor(lang);
    if (langLabel) langLabel.textContent = (lang === 'de') ? 'Deutsch' : 'English';
    stripLangParamFromUrl();
    updateLangTooltipForCurrent();

    // Menu button state
    setMenuButtonState(false);
    if (isMenuOpen()) setMenuButtonState(true);

    // Theme (load persisted or default to 'system')
    const stored = localStorage.getItem(THEME_KEY) || 'system';
    setThemeAttr(stored);
    updateThemeButtons(stored);

    // If overlay is already visible, enforce row layout immediately
    forceRowLayout();
  })();
})();
