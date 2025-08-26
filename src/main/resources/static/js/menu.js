// menu.js — central menu + theme + language + i18n runtime + sequence dispatch
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

  // --- lightweight i18n runtime --------------------------------------------------------------
  // Usage:
  //   await __epI18n.load('de'); __epI18n.apply(document);
  //   const s = __epI18n.t('menu.language','Language');
  window.__epI18n = window.__epI18n || (function(){
    const cache = new Map(); // lang -> catalog
    let lang = (document.documentElement.lang || 'en').toLowerCase();
    let catalog = null;

    function norm(l){ return (l||'en').toLowerCase().split('-')[0]; }

    async function load(nextLang){
      const target = norm(nextLang);
      if (catalog && lang === target) return catalog;
      if (cache.has(target)) { lang = target; catalog = cache.get(target); return catalog; }
      const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(target)}`, { credentials: 'same-origin' });
      const json = await res.json();
      cache.set(target, json);
      lang = target; catalog = json;

      // Also set session locale on server (ignore redirect)
      try { fetch(`/i18n?lang=${encodeURIComponent(target)}`, { credentials: 'same-origin', redirect: 'manual' }); } catch {}
      return catalog;
    }

    function t(key, fallback){
      if (catalog && Object.prototype.hasOwnProperty.call(catalog, key)) return String(catalog[key]);
      return (fallback != null) ? String(fallback) : key;
    }

    function apply(root){
      const r = root || document;
      // text content
      r.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n'); if (!key) return;
        el.textContent = t(key, el.textContent);
      });
      // attributes: data-i18n-attr="title:key1;aria-label:key2;data-tooltip:key3"
      r.querySelectorAll('[data-i18n-attr]').forEach(el => {
        const spec = el.getAttribute('data-i18n-attr'); if (!spec) return;
        spec.split(';').forEach(pair => {
          const [attr, k] = pair.split(':').map(s => s && s.trim());
          if (!attr || !k) return;
          el.setAttribute(attr, t(k, el.getAttribute(attr)));
        });
      });
      document.documentElement.setAttribute('lang', lang);
      // Tell the app
      try { document.dispatchEvent(new CustomEvent('ep:lang-changed', { detail: { lang, catalog } })); } catch {}
    }

    return { load, apply, t, get lang(){ return lang; }, get catalog(){ return catalog; } };
  })();

  // Tooltip helper
  function setNiceTooltip(el, text){
    if (!el) return;
    if (text) el.setAttribute('data-tooltip', text);
    else el.removeAttribute('data-tooltip');
    el.removeAttribute('title'); // no native browser tooltip
  }

  // --- Menu open/close + focus trap ----------------------------------------------------------
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

  // --- Theme ----------------------------------------------------------------------------------
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

  // --- Language (no-reload switch) ------------------------------------------------------------
  const langRow = doc.getElementById('langRow');
  const flagA   = langRow?.querySelector('.flag-a');
  const flagB   = langRow?.querySelector('.flag-b');
  const langLbl = doc.getElementById('langCurrent');

  function isDe(lang){ return String(lang||'').toLowerCase().startsWith('de'); }
  function labelFor(lang){ return isDe(lang) ? 'Deutsch' : 'English'; }
  function setSplit(lang){
    if (!flagA || !flagB) return;
    if (isDe(lang)) { flagA.src='/flags/de.svg'; flagB.src='/flags/at.svg'; if (langLbl) langLbl.textContent='Deutsch'; }
    else { flagA.src='/flags/us.svg'; flagB.src='/flags/gb.svg'; if (langLbl) langLbl.textContent='English'; }
  }
  function nextLang(cur){ return isDe(cur) ? 'en' : 'de'; }

  async function switchLangDynamic(to){
    try{
      await window.__epI18n.load(to);
      window.__epI18n.apply(document);           // swap texts/attributes live
      setSplit(to);                               // update flag row
      // Update theme tooltips with fresh catalog (fallback to previous dataset)
      const tipLight  = window.__epI18n.t('title.theme.light',  overlay?.dataset.tipThemeLight  || 'Theme: Light');
      const tipDark   = window.__epI18n.t('title.theme.dark',   overlay?.dataset.tipThemeDark   || 'Theme: Dark');
      const tipSystem = window.__epI18n.t('title.theme.system', overlay?.dataset.tipThemeSystem || 'Theme: System');

      setNiceTooltip(bLight,  tipLight);
      setNiceTooltip(bDark,   tipDark);
      setNiceTooltip(bSystem, tipSystem);

      const toLabel = labelFor(to);
      const tpl = window.__epI18n.t('title.lang.to', overlay?.dataset.tipLangTo || 'Switch language → {0}');
      setNiceTooltip(langRow, tpl.replace('{0}', toLabel));
    }catch(e){
      console.warn('[MENU] lang switch failed', e);
    }
  }

  // --- Sequence picker (overlay → app) --------------------------------------------------------
  function wireSequencePicker(){
    const root = doc.getElementById('menuSeqChoice');
    if (!root) return;
    root.addEventListener('change', (e) => {
      const r = e.target;
      if (!r || r.type !== 'radio' || r.name !== 'menu-seq') return;
      const id = r.value;
      try { document.dispatchEvent(new CustomEvent('ep:sequence-change', { detail: { id } })); } catch {}
    });
  }

  // --- Initial wiring after DOMContentLoaded --------------------------------------------------
  document.addEventListener('DOMContentLoaded', function(){
    // Theme init
    const saved = localStorage.getItem('estpoker-theme') || 'dark';
    ({light:bLight, dark:bDark, system:bSystem}[saved])?.classList.add('active');
    ({light:bLight, dark:bDark, system:bSystem}[saved])?.setAttribute('aria-pressed','true');
    // Pretty tooltips (init; will be updated again on lang change)
    const tipLight  = overlay?.dataset.tipThemeLight  || 'Theme: Light';
    const tipDark   = overlay?.dataset.tipThemeDark   || 'Theme: Dark';
    const tipSystem = overlay?.dataset.tipThemeSystem || 'Theme: System';
    setNiceTooltip(bLight,  tipLight);
    setNiceTooltip(bDark,   tipDark);
    setNiceTooltip(bSystem, tipSystem);

    // Theme buttons
    bLight?.addEventListener('click', ()=>applyTheme('light'));
    bDark?.addEventListener('click',  ()=>applyTheme('dark'));
    bSystem?.addEventListener('click',()=>applyTheme('system'));

    // Language row
    if (langRow) {
      const cur = (document.documentElement.lang || 'en');
      setSplit(cur);
      const to  = nextLang(cur);
      const tip = (overlay?.dataset.tipLangTo || 'Switch language → {0}').replace('{0}', labelFor(to));
      setNiceTooltip(langRow, tip);
      langRow.addEventListener('click', () => switchLangDynamic(nextLang(document.documentElement.lang || 'en')));
    }

    // Sequence radios
    wireSequencePicker();
  });

  // --- Room actions coming from overlay -------------------------------------------------------
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
