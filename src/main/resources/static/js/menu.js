// menu.js — zentrales Menü + Tooltips + Theme + Language (nur data-tooltip, nie title)
(function(){
  const doc = document;
  const btn = doc.getElementById('menuButton');
  const overlay = doc.getElementById('appMenuOverlay');
  const panel = overlay?.querySelector('.menu-panel');
  const backdrop = overlay?.querySelector('[data-close]');

  const TIP_THEME_LIGHT  = overlay?.dataset.tipThemeLight  || 'Theme: Light';
  const TIP_THEME_DARK   = overlay?.dataset.tipThemeDark   || 'Theme: Dark';
  const TIP_THEME_SYSTEM = overlay?.dataset.tipThemeSystem || 'Theme: System';
  const TPL_LANG_TO      = overlay?.dataset.tipLangTo      || 'Switch language → {0}';

  function setNiceTooltip(el, text){
    if (!el) return;
    if (text) el.setAttribute('data-tooltip', text);
    else el.removeAttribute('data-tooltip');
    el.removeAttribute('title'); // no browser tooltip
  }

  // ---- Menu open/close + focus trap ----
  let lastFocus = null;
  function focusables(){
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
    overlay.classList.add('hidden');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-label','Open menu');
    btn.textContent = '☰';
    window.removeEventListener('keydown', trapTab);
    lastFocus?.focus();
  }
  function toggleMenu(){ overlay.classList.contains('hidden') ? openMenu() : closeMenu(); }

  btn?.addEventListener('click', toggleMenu);
  backdrop?.addEventListener('click', closeMenu);
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeMenu(); });

  // ---- Theme ----
  const bLight  = doc.getElementById('themeLight');
  const bDark   = doc.getElementById('themeDark');
  const bSystem = doc.getElementById('themeSystem');

  function applyTheme(t){
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('estpoker-theme', t); } catch(e){}
    [bLight,bDark,bSystem].forEach(x=>x&&x.classList.remove('active'));
    ({light:bLight, dark:bDark, system:bSystem}[t||'dark'])?.classList.add('active');

    [bLight,bDark,bSystem].forEach(x=>x&&x.setAttribute('aria-pressed','false'));
    ({light:bLight, dark:bDark, system:bSystem}[t||'dark'])?.setAttribute('aria-pressed','true');
  }

  document.addEventListener('DOMContentLoaded', function(){
    const saved = localStorage.getItem('estpoker-theme') || 'dark';
    ({light:bLight, dark:bDark, system:bSystem}[saved])?.classList.add('active');
    ({light:bLight, dark:bDark, system:bSystem}[saved])?.setAttribute('aria-pressed','true');

    // pretty tooltips
    setNiceTooltip(bLight,  TIP_THEME_LIGHT);
    setNiceTooltip(bDark,   TIP_THEME_DARK);
    setNiceTooltip(bSystem, TIP_THEME_SYSTEM);

    bLight?.addEventListener('click', ()=>applyTheme('light'));
    bDark?.addEventListener('click',  ()=>applyTheme('dark'));
    bSystem?.addEventListener('click',()=>applyTheme('system'));
  });

  // ---- Language ----
  (function(){
    const row   = doc.getElementById('langRow');
    if (!row) return;
    const cur   = (document.documentElement.lang || 'en').toLowerCase();
    const a     = row.querySelector('.flag-a');
    const b     = row.querySelector('.flag-b');
    const label = doc.getElementById('langCurrent');

    function labelFor(lang){ return String(lang).startsWith('de') ? 'Deutsch' : 'English'; }
    function setSplit(lang){
      if (!a || !b) return;
      if (String(lang).startsWith('de')) { a.src='/flags/de.svg'; b.src='/flags/at.svg'; if (label) label.textContent='Deutsch'; }
      else { a.src='/flags/us.svg'; b.src='/flags/gb.svg'; if (label) label.textContent='English'; }
    }
    function nextLang(){ return cur.startsWith('de') ? 'en' : 'de'; }
    function switchLang(to){
      fetch('/i18n', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:'lang='+encodeURIComponent(to) })
        .finally(()=>location.reload());
    }

    document.addEventListener('DOMContentLoaded', function(){
      setSplit(cur);
      const to  = nextLang();
      const tip = (TPL_LANG_TO || 'Switch language → {0}').replace('{0}', labelFor(to));
      setNiceTooltip(row, tip);
      row.addEventListener('click', function(){ switchLang(to); });
    });
  })();

  // Expose util (falls jemand auf der Seite es nutzen will)
  window.__setNiceTooltip = setNiceTooltip;
})();
