/* room.js — robust boot + verbose logs */

(() => {
  // --- DEBUG MARKER (sichtbar im Console-Log) -------------------------------
  console.log("[ROOM] file loaded");

  // Safeguard: nur einmal booten
  let __booted = false;
  function onceBoot(fn){ if(__booted) return; __booted = true; fn(); }

  // Script-Tag & Daten
  const thisScript = document.currentScript || document.querySelector('script[src$="/room.js"]');
  let participantName = thisScript?.dataset?.participant || 'Guest';
  let roomCode        = thisScript?.dataset?.room || 'demo';

  // State
  let selectedCard = null;
  let votesRevealed = false;
  let isHost = false;
  let resizeTimer = null;
  let currentSequenceId = 'fib-scrum';
  let currentDeckSig = '';
  let myParticipating = true;

  // i18n Fallbacks (sichtbare Labels kommen eh aus dem DOM)
  const TXT_AVG='Avg:', TXT_CONS='Consensus:', TXT_MEDIAN='Median:', TXT_RANGE='Range:',
        TXT_OUTLIER_HINT='Farthest from average', TXT_ON='On', TXT_OFF='Off',
        TXT_AR_ONLY_HOST='Only the host can change this setting.', TXT_MAKE_HOST='Make host',
        TXT_KICK='Kick', TXT_KICKED='The host has closed the room for you.',
        TXT_IM_IN="I'm estimating", TXT_OBSERVER='Observer', TXT_OBS_NO_PICK='As an observer you can’t pick a card.',
        MSG_HOST_YOU='Host changed. You are now host!', MSG_HOST_OTHER='Host changed. {new} is now host.';

  let autoRevealEnabled=false, topicVisible=true, isEditingTopic=false;

  const SPECIALS = new Set(['❓','💬','☕']);
  const SEQ_CATALOG = Object.create(null);

  // Exponiere ein minimales Debug-Objekt
  window.__ep = {
    get info(){ return { readyState: document.readyState, participantName, roomCode, booted: __booted }; }
  };

  // ---------- UI/Deck-Helpers (unverändert) ----------
  function formatDeckForTooltip(cards){
    if(!Array.isArray(cards)) return '';
    const specials = cards.filter(c=>SPECIALS.has(String(c)));
    const core = cards.filter(c=>!SPECIALS.has(String(c)));
    const max=12, shown=core.slice(0,max), more=core.length>max?'…':'';
    return shown.join(', ')+(more?' '+more:'')+(specials.length?`  (${specials.join(' ')})`:'');
  }
  function updateSequenceTooltips(){
    document.querySelectorAll('#seqChoice .radio-row input[name="seq"]').forEach(inp=>{
      const row=inp.closest('.radio-row'); if(!row) return;
      const deck=SEQ_CATALOG[inp.value];
      if(deck?.length){ row.setAttribute('data-tooltip', formatDeckForTooltip(deck)); row.removeAttribute('title'); }
      else { row.removeAttribute('data-tooltip'); row.removeAttribute('title'); }
    });
  }
  function addCardButton(grid,val){
    const btn=document.createElement('button');
    btn.type='button'; btn.dataset.card=val; btn.textContent=val;
    btn.addEventListener('click', ()=>{ if(!myParticipating){ showToast(TXT_OBS_NO_PICK); return; } if(votesRevealed) return; sendVote(val); });
    grid.appendChild(btn);
  }
  const deckSig = arr => Array.isArray(arr)?arr.join('|'):'';
  function renderCards(deck){
    const area=document.getElementById('cardsArea'); if(!area||!Array.isArray(deck)) return;
    const regular=deck.filter(v=>!SPECIALS.has(v)), specials=deck.filter(v=>SPECIALS.has(v));
    area.innerHTML='';
    const g=document.createElement('div'); g.className='card-grid'; regular.forEach(v=>addCardButton(g,v)); area.appendChild(g);
    if(specials.length){ const s=document.createElement('div'); s.className='card-grid'; specials.forEach(v=>addCardButton(s,v)); area.appendChild(s); }
    updateCardInteractivity(myParticipating); highlightSelectedCard();
  }
  function updateCardInteractivity(canPick){
    const buttons=document.querySelectorAll('.card-grid button');
    const disable=!canPick || !!votesRevealed;
    buttons.forEach(b=>{ b.disabled=disable; if(disable){ b.setAttribute('data-tooltip',!canPick?TXT_OBS_NO_PICK:''); b.tabIndex=-1; } else { b.removeAttribute('data-tooltip'); b.removeAttribute('tabindex'); }});
  }
  function syncSequenceUI(){
    document.querySelectorAll('#seqChoice input[name="seq"]').forEach(r=>{
      r.checked=(r.value===currentSequenceId); r.disabled=!isHost; r.closest('.radio-row')?.classList.toggle('disabled',!isHost);
    });
    const hint=document.getElementById('seqHint'); if(hint) hint.style.display=isHost?'none':'block';
  }
  function syncAutoRevealUI(){
    const row=document.getElementById('autoRevealRow'); const st=document.getElementById('arStatus'); const cb=document.getElementById('autoRevealToggle');
    if(st) st.textContent=autoRevealEnabled?TXT_ON:TXT_OFF;
    if(cb){ cb.checked=autoRevealEnabled; cb.setAttribute('aria-checked',autoRevealEnabled?'true':'false'); cb.disabled=!isHost; }
    if(row) row.classList.toggle('disabled',!isHost);
    const hint=document.getElementById('arHint'); if(hint) hint.style.display=isHost?'none':'block';
  }
  function updateTopicDisplay(label,url){
    const d=document.getElementById('topicDisplay'); if(!d) return;
    if(!label && !url){ d.textContent='—'; return; }
    if(url){ const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.textContent=label||url; d.innerHTML=''; d.appendChild(a); }
    else d.textContent=label;
  }
  function applyTopicUI(){
    const st=document.getElementById('topicStatus'); if(st) st.textContent=topicVisible?TXT_ON:TXT_OFF;
    const row=document.getElementById('topicRow'), edit=document.getElementById('topicEdit'), eb=document.getElementById('topicEditBtn'), cb=document.getElementById('topicClearBtn');
    if(row) row.style.display=topicVisible?'grid':'none';
    if(eb) eb.style.display=isHost?'inline-flex':'none';
    if(cb) cb.style.display=isHost?'inline-flex':'none';
    if(edit) edit.style.display=(isHost&&isEditingTopic)?'grid':'none';
  }
  function parseTopicInput(raw){ if(!raw) return {label:null,url:null}; const s=String(raw).trim(); if(/^https?:\/\//i.test(s)){ const m=s.match(/[A-Z][A-Z0-9]+-\d+/); return {label:(m?m[0]:s),url:s}; } return {label:s,url:null}; }
  function syncParticipationUI(on){
    const st=document.getElementById('partStatus'); const cb=document.getElementById('participationToggle');
    myParticipating=!!on; if(st) st.textContent=on?TXT_IM_IN:TXT_OBSERVER;
    if(cb){ cb.checked=!!on; cb.setAttribute('aria-checked', on?'true':'false'); }
    if(!myParticipating) clearCardSelection();
    updateCardInteractivity(myParticipating); highlightSelectedCard();
  }

  // ---- WebSocket (reconnect + leave beacon) ----
  const cid = (()=>{ try{ const KEY='ep-cid'; let id=sessionStorage.getItem(KEY); if(!id){ id=(crypto.randomUUID?crypto.randomUUID():(Math.random().toString(36).slice(2)+'-'+Date.now())); sessionStorage.setItem(KEY,id); } return id; }catch(e){ return Math.random().toString(36).slice(2)+'-'+Date.now(); } })();
  const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
  const baseSocketUrl = wsProtocol + location.host
    + '/gameSocket?roomCode=' + encodeURIComponent(roomCode)
    + '&participantName=' + encodeURIComponent(participantName)
    + '&cid=' + encodeURIComponent(cid);

  let socket=null, isUnloading=false, reconnectAttempts=0;
  function connectWS(){
    console.log("[ROOM] connecting WS →", baseSocketUrl);
    try{
      socket = new WebSocket(baseSocketUrl);
      socket.onopen = () => { console.log("[ROOM] WS open"); reconnectAttempts=0; };
      socket.onmessage = handleMessage;
      socket.onerror = (e) => console.warn("[ROOM] WS error", e);
      socket.onclose = (e) => {
        console.warn("[ROOM] WS closed", e.code, e.reason || "");
        if(isUnloading) return;
        const delay = Math.min(8000, 500 * Math.pow(2, reconnectAttempts++));
        setTimeout(connectWS, delay);
      };
    } catch (e){
      console.error("[ROOM] WS ctor failed", e);
    }
  }

  function handleMessage(event){
    const data = JSON.parse(event.data);

    if (data.type === 'you' && typeof data.yourName === 'string') {
      if (!data.cid || data.cid === cid) {
        if (data.yourName !== participantName) {
          participantName = data.yourName;
          const you = document.getElementById('youName'); if (you) you.textContent = participantName;
        }
      }
      return;
    }

    if (Array.isArray(data.participants) && data.type !== 'voteUpdate') {
      const revealed = !!data.votesRevealed;
      updateParticipantList(data.participants, revealed);
    }

    if (data.sequenceId) {
      const newSig = deckSig(data.cards);
      const needRerender = (currentSequenceId !== data.sequenceId) || (newSig && newSig !== currentDeckSig);
      currentSequenceId = data.sequenceId;
      if (Array.isArray(data.cards)) { SEQ_CATALOG[data.sequenceId] = data.cards.slice(); updateSequenceTooltips(); }
      if (needRerender && Array.isArray(data.cards)) { clearCardSelection(); renderCards(data.cards); currentDeckSig = newSig; }
    }

    if (data.sequences && typeof data.sequences === 'object') { Object.assign(SEQ_CATALOG, data.sequences); updateSequenceTooltips(); }

    if (typeof data.yourName === 'string' && data.cid && data.cid === cid) {
      if (data.yourName !== participantName) { participantName = data.yourName; const you=document.getElementById('youName'); if(you) you.textContent=participantName; }
    }

    if (data.type === 'voteUpdate') {
      const prevRevealed = votesRevealed;
      const participants = Array.isArray(data.participants) ? data.participants : [];
      votesRevealed = data.votesRevealed;
      isHost = participants.find(p => p.name === participantName)?.isHost === true;

      if (typeof data.autoRevealEnabled === 'boolean') autoRevealEnabled = data.autoRevealEnabled;
      if (typeof data.topicVisible      === 'boolean') topicVisible      = data.topicVisible;

      syncAutoRevealUI(); syncSequenceUI();
      updateTopicDisplay(data.topicLabel || null, data.topicUrl || null); applyTopicUI();

      const me = participants.find(p => p.name === participantName);
      syncParticipationUI(me ? (me.participating !== false) : true);

      document.getElementById('revealButton').style.display = isHost && !votesRevealed ? 'inline-block' : 'none';
      document.getElementById('resetButton').style.display  = isHost &&  votesRevealed ? 'inline-block' : 'none';

      updateParticipantList(participants, votesRevealed);

      if (votesRevealed) {
        updateCardInteractivity(myParticipating);
        showResults(participants, data.averageVote);
      } else {
        toggleView(false);
        updateAverage(null); setConsensusUI(false); updateStatsUI(null);
        updateCardInteractivity(myParticipating);
      }

      if (prevRevealed && !votesRevealed) clearCardSelection();
      highlightSelectedCard();

    } else if (data.type === 'hostChanged') {
      const { oldHost, newHost } = data;
      const iBecomeHost = (newHost === participantName);
      const iLoseHost   = (oldHost === participantName);
      if (iBecomeHost || iLoseHost) {
        isHost = iBecomeHost;
        document.getElementById('revealButton').style.display = isHost && !votesRevealed ? 'inline-block' : 'none';
        document.getElementById('resetButton').style.display  = isHost &&  votesRevealed ? 'inline-block' : 'none';
        syncSequenceUI(); syncAutoRevealUI(); applyTopicUI();
      }
      showToast(iBecomeHost ? MSG_HOST_YOU : MSG_HOST_OTHER.replace('{new}', newHost));

    } else if (data.type === 'kicked') {
      try { localStorage.setItem('ep-toast', TXT_KICKED); } catch(e){}
      location.replace(data.redirect || '/');

    } else if (data.type === 'roomClosed') {
      location.replace(data.redirect || '/');
    }
  }

  function sendLeaveSignalsOnce(){
    if (isUnloading) return;
    isUnloading = true;
    try { if (socket && socket.readyState === 1) socket.send('leavingNow'); } catch(e){}
    try {
      const payload = new Blob([JSON.stringify({ roomCode, cid })], { type: 'application/json' });
      navigator.sendBeacon('/signal/bye', payload);
    } catch(e){}
  }
  window.addEventListener('pagehide', sendLeaveSignalsOnce, { capture:true });
  window.addEventListener('beforeunload', sendLeaveSignalsOnce, { capture:true });

  // ---------- BOOT-SEQUENZ (idempotent + mehrere Trigger) -------------------
  function boot(){
    onceBoot(() => {
      console.log("[ROOM] boot", { readyState: document.readyState, participantName, roomCode });
      connectWS();

      // Host-only / Controls
      document.getElementById('seqChoice')?.addEventListener('change', e=>{
        const val=e.target?.value; if(!val) return;
        if(!isHost){ showToast('Only the host can change the sequence'); syncSequenceUI(); return; }
        socket?.send('setSequence:'+val);
      });

      const arRow=document.getElementById('autoRevealRow'); const arToggle=document.getElementById('autoRevealToggle');
      arRow?.addEventListener('click', e=>{ if(!isHost){ e.preventDefault(); e.stopPropagation(); showToast(TXT_AR_ONLY_HOST); }});
      arToggle?.addEventListener('click', ()=>{ if(isHost) socket?.send('setAutoReveal:' + !autoRevealEnabled); });

      const tvRow=document.getElementById('topicToggleRow'); const tvCb=document.getElementById('topicToggle');
      tvRow?.addEventListener('click', e=>{ if(!isHost){ e.preventDefault(); e.stopPropagation(); showToast(TXT_AR_ONLY_HOST); }});
      tvCb?.addEventListener('click', ()=>{ if(isHost) socket?.send('setTopicVisible:' + !topicVisible); });

      const inEl=document.getElementById('topicInput'), saveBtn=document.getElementById('topicSaveBtn'),
            cancel=document.getElementById('topicCancelBtn'), editBtn=document.getElementById('topicEditBtn'),
            clearBtn=document.getElementById('topicClearBtn');

      editBtn?.addEventListener('click', ()=>{ if(!isHost) return; isEditingTopic=true; applyTopicUI(); inEl?.focus(); });
      cancel?.addEventListener('click', ()=>{ isEditingTopic=false; applyTopicUI(); });

      saveBtn?.addEventListener('click', ()=>{ if(!isHost) return;
        const {label,url}=parseTopicInput(inEl?.value||'');
        const enc = encodeURIComponent(label||'') + '|' + encodeURIComponent(url||'');
        socket?.send('setTopic:'+enc); isEditingTopic=false; if(inEl) inEl.value=''; showToast('Topic saved');
      });
      inEl?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); saveBtn?.click(); }});
      clearBtn?.addEventListener('click', ()=>{ if(!isHost) return; socket?.send('clearTopic'); showToast('Topic cleared'); });

      const partToggle=document.getElementById('participationToggle');
      partToggle?.addEventListener('click', ()=>{ const next=!myParticipating; syncParticipationUI(next); socket?.send('setParticipating:'+next); });

      // Tooltips vorbefüllen (optional)
      try{
        fetch('/sequences').then(r=>r.ok?r.json():null).then(json=>{
          const obj=json?.sequences||json; if(obj && typeof obj==='object'){ Object.assign(SEQ_CATALOG,obj); updateSequenceTooltips(); }
        }).catch(()=>{});
      }catch(e){}
    });
  }

  // so gut wie unmöglich zu verpassen:
  if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
  document.addEventListener('DOMContentLoaded', boot, { once:true });
  window.addEventListener('load', boot, { once:true });
  // falls irgendwas *trotzdem* schiefgeht: Notanker
  setTimeout(()=>boot(), 1000);

  // ---------- Voting Helpers / Toast / List / Stats (wie gehabt) -----------
  window.revealCards = () => { if (isHost) socket?.send('revealCards'); };
  window.resetRoom   = () => { if (isHost) socket?.send('resetRoom'); clearCardSelection(); };

  function sendVote(cardValue){ if(!myParticipating){ showToast(TXT_OBS_NO_PICK); return; } if(votesRevealed) return;
    socket?.send('vote:' + participantName + ':' + cardValue); selectedCard=cardValue; highlightSelectedCard(); }
  function clearCardSelection(){ selectedCard=null; try{ localStorage.removeItem('selectedCard'); }catch(e){} highlightSelectedCard(); }
  function highlightSelectedCard(){ document.querySelectorAll('.card-grid button').forEach(btn=>{ const sel=myParticipating&&!votesRevealed&&(btn.dataset.card===selectedCard); btn.classList.toggle('selected',sel); }); }

  function updateParticipantList(participants,revealed){
    const list=document.getElementById('liveParticipantList'); if(!list) return; list.innerHTML='';
    participants.forEach(p=>{
      const li=document.createElement('li'); li.classList.add('participant-row'); li.dataset.hasvote = p.vote !== null;
      if(p.disconnected) li.classList.add('disconnected'); if(p.isHost) li.classList.add('is-host');
      const icon=document.createElement('span'); icon.className=p.isHost?'participant-icon host':(p.disconnected?'participant-icon inactive':'participant-icon'); icon.textContent=p.isHost?'👑':(p.disconnected?'💤':'👤');
      const name=document.createElement('span'); name.className='name'; name.textContent=p.name;
      const right=document.createElement('div'); right.className='row-right';
      if(revealed){
        if(p.participating===false){ const s=document.createElement('span'); s.className='status-icon observer'; s.textContent='👀'; right.appendChild(s); }
        else{ const chip=document.createElement('span'); chip.className='vote-chip';
          const v=p.vote!=null?String(p.vote):null; const n=v!=null?parseFloat(String(v).replace(',','.')):null;
          chip.textContent=v!=null?v:'—'; chip.dataset.val=v!=null?v:''; if(Number.isFinite(n)){ chip.dataset.num=String((Math.round(n*1000)/1000).toFixed(3)); } else { chip.classList.add('special'); }
          right.appendChild(chip);
        }
      } else {
        if(!p.disconnected){
          const s=document.createElement('span');
          if(p.participating===false){ s.className='status-icon observer'; s.textContent='👀'; }
          else if(p.vote!=null){ s.className='status-icon done'; s.textContent='✅'; }
          else { s.className='status-icon pending'; s.textContent='⏳'; }
          right.appendChild(s);
        }
      }
      const actions=document.createElement('div'); actions.className='row-actions';
      if(isHost && !p.isHost && p.name!==participantName){
        const mk=document.createElement('button'); mk.type='button'; mk.className='row-action host';
        mk.setAttribute('aria-label', TXT_MAKE_HOST+': '+p.name); mk.setAttribute('data-tooltip', TXT_MAKE_HOST);
        mk.innerHTML='<span class="ra-icon">👑</span><span class="ra-label">'+TXT_MAKE_HOST+'</span>';
        mk.addEventListener('click', ()=>{ if(isHost) socket?.send('transferHost:'+p.name); });
        actions.appendChild(mk);
        const kb=document.createElement('button'); kb.type='button'; kb.className='row-action kick';
        kb.setAttribute('aria-label', TXT_KICK+': '+p.name); kb.setAttribute('data-tooltip', TXT_KICK);
        kb.innerHTML='<span class="ra-icon">❌</span><span class="ra-label">'+TXT_KICK+'</span>';
        kb.addEventListener('click', ()=>{ if(isHost) socket?.send('kick:'+p.name); });
        actions.appendChild(kb);
      }
      if(actions.childElementCount) right.appendChild(actions);
      li.appendChild(icon); li.appendChild(name); li.appendChild(right); list.appendChild(li);
    });
    measureAndSetNameColumn();
  }
  function measureAndSetNameColumn(){
    const list=document.getElementById('liveParticipantList'); if(!list) return;
    const names=Array.from(list.querySelectorAll('.name')); const maxW=names.reduce((m,el)=>Math.max(m, el.offsetWidth||0),0);
    list.style.setProperty('--name-text-col', Math.ceil(maxW)+'px');
  }
  window.addEventListener('resize', ()=>{ clearTimeout(resizeTimer); resizeTimer=setTimeout(measureAndSetNameColumn,150); });

  function updateAverage(avg){ const el=document.getElementById('averageVote'); if(el) el.textContent = avg!=null?avg:'-'; }
  function setConsensusUI(on){ const row=document.getElementById('resultRow'); const lbl=document.getElementById('resultLabel'); if(!row||!lbl) return; lbl.textContent = on?TXT_CONS:TXT_AVG; row.classList.toggle('consensus',!!on); }
  function hasConsensus(participants){
    const active=participants.filter(p=>!p.disconnected && p.participating!==false); if(!active.length) return false;
    const nums=[]; for(const p of active){ if(p.vote==null) return false; const s=String(p.vote).trim(); if(SPECIALS.has(s)) return false; const n=parseFloat(s.replace(',','.')); if(!Number.isFinite(n)) return false; nums.push(Math.round(n*1000)/1000); }
    return nums.every(v=>v===nums[0]);
  }
  function applyConsensusUI(on){ setConsensusUI(on); if(on){ updateStatsUI(null); markOutliers(null); } }
  const fmt=n=> (n==null||!Number.isFinite(n))?'-': String(Math.round(n*100)/100);
  function computeStats(participants){
    const nums=[]; for(const p of participants){ if(p && !p.disconnected && p.participating!==false){ const s=String(p.vote??'').trim(); if(!SPECIALS.has(s)){ const n=parseFloat(s.replace(',','.')); if(Number.isFinite(n)) nums.push(Math.round(n*1000)/1000); } } }
    if(nums.length<1) return null; const a=nums.slice().sort((x,y)=>x-y); const min=a[0], max=a[a.length-1];
    const median = a.length%2===1 ? a[(a.length-1)/2] : (a[a.length/2 - 1] + a[a.length/2]) / 2;
    const mean=a.reduce((s,v)=>s+v,0)/a.length; const deltas=a.map(v=>Math.abs(v-mean)); const maxDelta=Math.max(...deltas);
    const outlierNums=new Set(a.filter(v=>Math.abs(v-mean)===maxDelta).map(v=>String((Math.round(v*1000)/1000).toFixed(3))));
    return { median, rangeMin:min, rangeMax:max, outlierNums };
  }
  function updateStatsUI(stats){
    const mWrap=document.getElementById('medianWrap'), rWrap=document.getElementById('rangeWrap'), rSep=document.getElementById('rangeSep');
    const mLbl=document.getElementById('medianLabel'), rLbl=document.getElementById('rangeLabel');
    const mVal=document.getElementById('medianVote'), rVal=document.getElementById('rangeVote');
    if(!mWrap||!rWrap||!mVal||!rVal||!mLbl||!rLbl) return;
    if(!stats){ mWrap.hidden=true; rWrap.hidden=true; rSep.hidden=true; return; }
    mLbl.textContent=TXT_MEDIAN; rLbl.textContent=TXT_RANGE;
    mVal.textContent=fmt(stats.median); rVal.textContent=fmt(stats.rangeMin)+'–'+fmt(stats.rangeMax);
    mWrap.hidden=false; rWrap.hidden=false; rSep.hidden=false;
  }
  function markOutliers(nums){
    document.querySelectorAll('.vote-chip.outlier').forEach(el=>{ el.classList.remove('outlier'); el.removeAttribute('data-tooltip'); });
    if(!nums?.size) return;
    document.querySelectorAll('#liveParticipantList .vote-chip[data-num]').forEach(chip=>{
      if(nums.has(chip.getAttribute('data-num'))) { chip.classList.add('outlier'); chip.setAttribute('data-tooltip', TXT_OUTLIER_HINT); }
    });
  }
  function toggleView(revealed){
    document.querySelectorAll('.pre-vote').forEach(e=>e.style.display = revealed?'none':'block');
    document.querySelectorAll('.post-vote').forEach(e=>e.style.display = revealed?'block':'none');
  }
  function showResults(participants, avg){
    toggleView(true); updateAverage(avg);
    const cons=hasConsensus(participants); applyConsensusUI(cons);
    if(!cons){ const stats=computeStats(participants); updateStatsUI(stats); markOutliers(stats?stats.outlierNums:null); }
  }

  function showToast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),3000); }
})();
