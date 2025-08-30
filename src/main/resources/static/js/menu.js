/* menu.js v19 — robust open/close; full-row switches; auto-add 'switch' class; split flags */
(() => {
  'use strict';
  const TAG='[MENU]';
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const on = (el,ev,fn,o)=>el&&el.addEventListener(ev,fn,o);

  const btn=$('#menuButton'), overlay=$('#appMenuOverlay');
  const panel=overlay?.querySelector('.menu-panel'), backdrop=overlay?.querySelector('[data-close]');
  if(!btn||!overlay||!panel){ console.error(TAG,'markup missing'); return; }

  // Open/close
  let lastFocus=null;
  const isOpen=()=>!overlay.classList.contains('hidden');
  function openMenu(){
    if(isOpen()) return;
    lastFocus=document.activeElement;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('menu-open');
    btn.setAttribute('aria-expanded','true');
    (panel.querySelector('button,[role="button"],input,[tabindex]:not([tabindex="-1"])')||panel).focus?.({preventScroll:true});
  }
  function closeMenu(){
    if(!isOpen()) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('menu-open');
    btn.setAttribute('aria-expanded','false');
    lastFocus && document.contains(lastFocus) && lastFocus.focus?.({preventScroll:true});
  }
  on(btn,'click',openMenu);
  on(backdrop,'click',closeMenu);
  on(document,'keydown',e=>{ if(e.key==='Escape'&&isOpen()){ e.preventDefault(); closeMenu(); }});
  on(overlay,'mousedown',e=>{ if(!panel.contains(e.target)) closeMenu(); });

  // Mini tooltip (data-tooltip)
  const tip=document.createElement('div'); tip.className='tooltip'; document.body.appendChild(tip);
  function showTip(el){
    const t=el.getAttribute('data-tooltip'); if(!t) return;
    tip.textContent=t; tip.style.display='block'; tip.style.visibility='hidden';
    requestAnimationFrame(()=>{
      const r=el.getBoundingClientRect();
      tip.style.top = `${r.bottom+8+window.scrollY}px`;
      tip.style.left= `${Math.max(8, r.left + r.width/2 - tip.offsetWidth/2 + window.scrollX)}px`;
      tip.style.visibility='visible';
    });
  }
  function hideTip(){ tip.style.display='none'; tip.style.visibility='hidden'; }
  overlay.addEventListener('mouseover',e=>{ const el=e.target.closest('[data-tooltip]'); if(el) showTip(el); });
  overlay.addEventListener('mouseout', e=>{ if(e.target.closest('[data-tooltip]')) hideTip(); });

  // Theme
  const tBtns={light:$('#themeLight'),dark:$('#themeDark'),system:$('#themeSystem')};
  function applyTheme(mode){
    const root=document.documentElement;
    if(mode==='system'){ root.removeAttribute('data-theme'); localStorage.removeItem('ep-theme'); }
    else { root.setAttribute('data-theme',mode); localStorage.setItem('ep-theme',mode); }
    Object.entries(tBtns).forEach(([k,b])=>b?.setAttribute('aria-pressed', String(k===mode)));
  }
  on(tBtns.light,'click',()=>applyTheme('light'));
  on(tBtns.dark,'click',()=>applyTheme('dark'));
  on(tBtns.system,'click',()=>applyTheme('system'));
  applyTheme(localStorage.getItem('ep-theme') || 'system');

  // Language row + split flags (EN: US↙/GB↘, DE: DE↙/AT↘)
  const langRow   = $('#langRow');
  const langCur   = $('#langCurrent');
  const flagA     = $('.flag-split .flag-a');
  const flagB     = $('.flag-split .flag-b');
  const isDe      = ()=> (document.documentElement.lang||'en').toLowerCase().startsWith('de');
  const current   = ()=> (isDe()?'de':'en');
  const next      = ()=> (current()==='en'?'de':'en');

  function updateLangLabel(){ if(langCur) langCur.textContent = isDe() ? 'Deutsch' : 'English'; }
  function updateSplitFlags(){
    if(!flagA||!flagB) return;
    if(isDe()){ flagA.src='/flags/de.svg'; flagB.src='/flags/at.svg'; }
    else      { flagA.src='/flags/us.svg'; flagB.src='/flags/gb.svg'; }
  }
  on(langRow,'click',()=>{ const u=new URL(location.href); u.searchParams.set('lang', next()); location.href=u.toString(); });
  updateLangLabel(); updateSplitFlags();

  // Ensure any .menu-item that contains a switch-control gets the 'switch' class (safety)
  $$('.menu-item').forEach(row=>{ if(row.querySelector('input.switch-control')) row.classList.add('switch'); });

  // Whole-row toggling for switches
  $$('.menu-item.switch').forEach(row=>{
    on(row,'click',(e)=>{
      if(e.target.closest('input')) return;
      const input = row.querySelector('input.switch-control');
      if(!input || input.disabled) return;
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    });
  });

  // Auto-reveal
  on($('#menuAutoRevealToggle'),'change',e=>{
    const onv=!!e.target.checked;
    document.dispatchEvent(new CustomEvent('ep:auto-reveal-toggle',{detail:{on:onv}}));
    const st=$('#menuArStatus'); if(st) st.textContent= onv ? (isDe()?'An':'On') : (isDe()?'Aus':'Off');
  });

  // Topic visible
  on($('#menuTopicToggle'),'change',e=>{
    const onv=!!e.target.checked;
    document.dispatchEvent(new CustomEvent('ep:topic-toggle',{detail:{on:onv}}));
    const st=$('#menuTopicStatus'); if(st) st.textContent= onv ? (isDe()?'An':'On') : (isDe()?'Aus':'Off');
  });

  // Participation
  on($('#menuParticipationToggle'),'change',e=>{
    const estimating=!!e.target.checked;
    document.dispatchEvent(new CustomEvent('ep:participation-toggle',{detail:{estimating}}));
    const st=$('#menuPartStatus');
    if(st) st.textContent = estimating ? (isDe()?'Ich schätze mit':"I'm estimating")
                                       : (isDe()?'Beobachter:in':'Observer');
  });

  // Sequences + tooltips
  const seqRoot = $('#menuSeqChoice');
  if(seqRoot){
    on(seqRoot,'change',e=>{
      const r=e.target;
      if(r && r.matches('input[type="radio"][name="menu-seq"]')){
        document.dispatchEvent(new CustomEvent('ep:sequence-change',{detail:{id:r.value}}));
      }
    });
    const tips={
      'fib.scrum': seqRoot.dataset.tipFibScrum,
      'fib.enh'  : seqRoot.dataset.tipFibEnh,
      'fib.math' : seqRoot.dataset.tipFibMath,
      'pow2'     : seqRoot.dataset.tipPow2,
      'tshirt'   : seqRoot.dataset.tipTshirt,
    };
    $$('.radio-row', seqRoot).forEach(lbl=>{
      const id = $('input',lbl)?.value;
      if(id && tips[id]) lbl.setAttribute('data-tooltip', tips[id]);
    });
  }

  // Close room
  on($('#closeRoomBtn'),'click',()=>{ document.dispatchEvent(new CustomEvent('ep:close-room')); });

  console.info(TAG,'Ready v19');
})();
