// menu.js — central menu + tooltips + theme + language (data-tooltip only)
(function(){
  // Prevent double-binding if the script is accidentally loaded twice.
  if (window.__epMenuInit) return; window.__epMenuInit = true;

  const doc = document;
  const btn = doc.getElementById('menuButton');
  const overlay = doc.getElementById('appMenuOverlay'); // root for the dialog
  const panel = overlay?.querySelector('.menu-panel');
  const backdrop = overlay?.querySelector('[data-close]');

  // If the menu fragment is not present on the page, bail out gracefully.
  if (!btn || !overlay) return;

  const TIP_THEME_LIGHT  = overlay?.dataset.tipThemeLight  || 'Theme: Light';
  const TIP_THEME_DARK   = overlay?.dataset.tipThemeDark   || 'Theme: Dark';
  const TIP_THEME_SYSTEM = overlay?.dataset.tipThemeSystem || 'Theme: System';
  const TPL_LANG_TO      = overlay?.dataset.tipLangTo      || 'Switch language → {0}';

  function setNiceTooltip(el, text){
    if (!el) return;
    if (text) el.setAttribute('data-tooltip', text);
    else el.removeAttribute('data-tooltip');
    el.removeAttribute('title'); // no native browser tooltip
  }

  /* ---- Menu open/close + focus trap ---- */
  let lastFocus = null;
  function focusables(){
    // Focus trap: collect interactive elements within the panel
    return panel?.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') || [];
  }
  function trapTab(e){
    if (e.key !== 'Tab' || overlay.classList.contains('hidden')) return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length-1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
  function openMenu(){
    document.body.classList.add('menu-open');
    window.__epTooltipHide && window.__epTooltipHide();
    overlay.classList.remove('hidden');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded','true');
    btn.setAttribute('aria-label','Close menu');
    btn.textContent = '✕';
    lastFocus = document.activeElement;
    setTimeout(()=>focusables()[0]?.focus(), 0);
    window.addEventListener('keydown', trapTab);
  }
  function closeMenu(){
    document.body.classList.remove('menu-open');
    window.__epTooltipHide && window.__epTooltipHide();
    overlay.classList.add('hidden');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-label','Open menu');
    btn.textContent = '☰';
    window.removeEventListener('keydown', trapTab);
    lastFocus?.focus();
  }
  function toggleMenu(){ overlay.classList.contains('hidden') ? openMenu() : closeMenu(); }

  btn.addEventListener('click', toggleMenu);
  backdrop?.addEventListener('click', closeMenu);
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeMenu(); });

  /* ---- Theme ---- */
  const bLight  = doc.getElementById('themeLight');
  const bDark   = doc.getElementById('themeDark');
  const bSystem = doc.getElementById('themeSystem');

  function applyTheme(t){
    // Apply theme to <html data-theme="...">, or remove for system
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);

    // Persist user choice
    try { localStorage.setItem('estpoker-theme', t); } catch(e){}

    // Visual state for buttons
    [bLight,bDark,bSystem].forEach(x=>x&&x.classList.remove('active'));
    ({light:bLight, dark:bDark, system:bSystem}[t||'dark'])?.classList.add('active');

    [bLight,bDark,bSystem].forEach(x=>x&&x.setAttribute('aria-pressed','false'));
    ({light:bLight, dark:bDark, system:bSystem}[t||'dark'])?.setAttribute('aria-pressed','true');
  }

  document.addEventListener('DOMContentLoaded', function(){
    const saved = localStorage.getItem('estpoker-theme') || 'dark';
    ({light:bLight, dark:bDark, system:bSystem}[saved])?.classList.add('active');
    ({light:bLight, dark:bDark, system:bSystem}[saved])?.setAttribute('aria-pressed','true');

    // Pretty tooltips
    setNiceTooltip(bLight,  TIP_THEME_LIGHT);
    setNiceTooltip(bDark,   TIP_THEME_DARK);
    setNiceTooltip(bSystem, TIP_THEME_SYSTEM);

    // Theme buttons
    bLight?.addEventListener('click', ()=>applyTheme('light'));
    bDark?.addEventListener('click',  ()=>applyTheme('dark'));
    bSystem?.addEventListener('click',()=>applyTheme('system'));
  });

  /* ---- Language ---- */
  (function(){
    const row   = doc.getElementById('langRow');
    if (!row) return;

    const a     = row.querySelector('.flag-a');
    const b     = row.querySelector('.flag-b');
    const label = doc.getElementById('langCurrent');

    function isDe(lang){ return String(lang||'').toLowerCase().startsWith('de'); }
    function labelFor(lang){ return isDe(lang) ? 'Deutsch' : 'English'; }
    function setSplit(lang){
      if (!a || !b) return;
      if (isDe(lang)) { a.src='/flags/de.svg'; b.src='/flags/at.svg'; if (label) label.textContent='Deutsch'; }
      else { a.src='/flags/us.svg'; b.src='/flags/gb.svg'; if (label) label.textContent='English'; }
    }
    function nextLang(cur){ return isDe(cur) ? 'en' : 'de'; }

    // GET /i18n?lang=... (server sets session locale and redirects back)
    function switchLang(to){ location.href = '/i18n?lang=' + encodeURIComponent(to); }

    document.addEventListener('DOMContentLoaded', function(){
      const cur = (document.documentElement.lang || 'en');
      setSplit(cur);
      const to  = nextLang(cur);
      const tip = (TPL_LANG_TO || 'Switch language → {0}').replace('{0}', labelFor(to));
      setNiceTooltip(row, tip);
      row.addEventListener('click', function(){ switchLang(to); });
    });
  })();

  /* ---- Room actions coming from overlay ---- */
  const closeBtn = doc.getElementById('closeRoomBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      // bubble an app-level event; room.js listens and will confirm + send ws
      document.dispatchEvent(new CustomEvent('ep:close-room'));
      closeMenu();
    });
  }

  // Expose util (optional reuse)
  window.__setNiceTooltip = setNiceTooltip;
})();
