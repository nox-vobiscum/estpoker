// menu.js — central menu + tooltips + theme + language (use only data-tooltip, never title)
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

    setNiceTooltip(bLight,  TIP_THEME_LIGHT);
    setNiceTooltip(bDark,   TIP_THEME_DARK);
    setNiceTooltip(bSystem, TIP_THEME_SYSTEM);

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

  /* ---- Bridge: menu overlay controls ↔ room controls ---- */
  document.addEventListener('DOMContentLoaded', function(){
    const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
    const ON  = isDe ? 'An' : 'On';
    const OFF = isDe ? 'Aus' : 'Off';

    function syncToggle(srcId, dstId, statusId, onLabel, offLabel){
      const src = document.getElementById(srcId);
      const dst = document.getElementById(dstId);
      const status = document.getElementById(statusId);
      if (!src) return;

      function setStatus(checked){
        if (!status) return;
        status.textContent = checked ? onLabel : offLabel;
      }

      if (dst) {
        // initial mirror
        src.checked = !!dst.checked;
        src.setAttribute('aria-checked', String(!!dst.checked));
        setStatus(!!dst.checked);

        // menu → room
        src.addEventListener('change', () => {
          if (dst.checked !== src.checked) {
            dst.checked = src.checked;
            dst.dispatchEvent(new Event('change', { bubbles: true }));
          }
          src.setAttribute('aria-checked', String(!!src.checked));
          setStatus(!!src.checked);
        });

        // room → menu
        dst.addEventListener('change', () => {
          if (src.checked !== dst.checked) {
            src.checked = dst.checked;
            src.setAttribute('aria-checked', String(!!dst.checked));
            setStatus(!!dst.checked);
          }
        });
      } else {
        // no destination control present
        setStatus(!!src.checked);
      }
    }

    // Mirror topic + participation (server logic already in room.js)
    syncToggle('menuTopicToggle', 'topicToggle', 'menuTopicStatus', ON, OFF);
    syncToggle(
      'menuParticipationToggle',
      'participationToggle',
      'menuPartStatus',
      isDe ? 'Ich schätze mit' : "I'm estimating",
      isDe ? 'Beobachter:in' : 'Observer'
    );

    // Close room: broadcast an event; room.js will handle it.
    const closeBtn  = document.getElementById('closeRoomBtn');
    const closeHint = document.getElementById('menuCloseHint');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('ep:close-room', { bubbles: true }));
        if (closeHint) { closeHint.style.display = ''; setTimeout(()=>closeHint.style.display='none', 2000); }
      });
    }

    // TODO (separater Schritt): menuAutoRevealToggle + menuSeqChoice anbinden,
    // sobald Handler-Message-Typen dafür drin sind.
  });

  // Expose util (reuse by others)
  window.__setNiceTooltip = setNiceTooltip;
})();
