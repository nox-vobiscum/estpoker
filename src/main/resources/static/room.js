/* room.js v11 — stable WS (no leave on visibilitychange) + keepalive */
(() => {
  'use strict';
  const TAG = '[ROOM]';
  const $ = (sel) => document.querySelector(sel);

  // data-* / URL
  const scriptEl = document.querySelector('script[src*="/room.js"]');
  const ds = (scriptEl && scriptEl.dataset) || {};
  const url = new URL(location.href);

  const state = {
    roomCode: ds.room || url.searchParams.get('roomCode') || 'demo',
    youName:  ds.participant || url.searchParams.get('participantName') || 'Guest',
    cid:      null,
    ws:       null,
    connected:false,
    isHost:   false,
    votesRevealed:false,
    cards:    [],
    participants:[],
    averageVote:null,
    keepaliveId:null,
    reconnectDelay: 1500
  };

  // stable client id per tab
  const CIDKEY = 'ep-cid';
  try {
    state.cid = sessionStorage.getItem(CIDKEY);
    if (!state.cid) {
      state.cid = Math.random().toString(36).slice(2) + '-' + Date.now();
      sessionStorage.setItem(CIDKEY, state.cid);
    }
  } catch(_) { state.cid = 'cid-' + Date.now(); }

  // small DOM helpers
  const setText = (id, v) => { const el = typeof id === 'string' ? $(id) : id; if (el) el.textContent = v ?? ''; };
  setText('#youName', state.youName);
  setText('#roomCodeVal', state.roomCode);

  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return proto + location.host
      + '/gameSocket?roomCode=' + encodeURIComponent(state.roomCode)
      + '&participantName=' + encodeURIComponent(state.youName)
      + '&cid=' + encodeURIComponent(state.cid);
  }

  function startKeepalive() {
    stopKeepalive();
    state.keepaliveId = setInterval(() => {
      try { if (state.ws && state.ws.readyState === 1) state.ws.send('ping'); } catch(_){}
    }, 25000);
  }
  function stopKeepalive() {
    if (state.keepaliveId) { clearInterval(state.keepaliveId); state.keepaliveId = null; }
  }

  function connectWS() {
    const u = wsUrl();
    console.info(TAG, 'connecting WS →', u);
    try { state.ws = new WebSocket(u); }
    catch (e) { console.error(TAG, 'WS ctor failed', e); return; }

    const s = state.ws;

    s.onopen = () => {
      state.connected = true;
      state.reconnectDelay = 1500; // reset backoff
      startKeepalive();
      console.info(TAG, 'OPEN');
    };

    s.onclose = (ev) => {
      state.connected = false;
      stopKeepalive();
      console.warn(TAG, 'CLOSE', ev.code, ev.reason||'');
      // jittered backoff
      const delay = Math.min(15000, Math.floor(state.reconnectDelay * (1.2 + Math.random() * 0.4)));
      state.reconnectDelay = delay;
      setTimeout(() => { if (!state.connected) connectWS(); }, delay);
    };

    s.onerror = (e) => console.warn(TAG, 'ERROR', e);

    s.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        handleMessage(msg);
      } catch (_) {
        // non-JSON (e.g., "pong") ignorieren
      }
    };
  }

  function send(line){ if (state.ws && state.ws.readyState === 1) state.ws.send(line); }

  function handleMessage(m) {
    switch (m.type) {
      case 'you':
        if (m.yourName && m.yourName !== state.youName) { state.youName = m.yourName; setText('#youName', state.youName); }
        break;
      case 'voteUpdate': {
        state.cards         = Array.isArray(m.cards) ? m.cards : state.cards;
        state.votesRevealed = !!m.votesRevealed;
        state.averageVote   = m.averageVote ?? null;
        state.participants  = Array.isArray(m.participants) ? m.participants : [];
        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);
        renderParticipants(); renderCards(); renderResultBar();
        break;
      }
      case 'roomClosed':
        alert('Room was closed by host.');
        try { state.ws && state.ws.close(4001, 'room closed'); } catch(_){}
        break;
      default: break;
    }
  }

  function renderParticipants() {
    const ul = $('#liveParticipantList'); if (!ul) return;
    ul.innerHTML = '';
    state.participants.forEach(p => {
      const li = document.createElement('li'); li.className = 'p-row';
      if (p.isHost) { const crown = document.createElement('span'); crown.textContent = '👑 '; li.appendChild(crown); }
      const nameSpan = document.createElement('span'); nameSpan.textContent = p.name; li.appendChild(nameSpan);
      const status = document.createElement('span'); status.className = 'p-status';
      if (p.disconnected) status.textContent = ' 🧱';
      else if (!state.votesRevealed) status.textContent = (p.vote != null ? ' ✓' : '');
      else status.textContent = (p.vote != null ? `  ${p.vote}` : '  –');
      li.appendChild(status);
      ul.appendChild(li);
    });
  }

  function renderCards() {
    const grid = $('#cardGrid'); if (!grid) return;
    grid.innerHTML = '';
    const disabled = state.votesRevealed;
    state.cards.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'card'; btn.textContent = String(val); btn.disabled = !!disabled;
      btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`));
      grid.appendChild(btn);
    });
    const revealBtn = $('#revealButton'); const resetBtn = $('#resetButton');
    if (revealBtn) revealBtn.style.display = (!state.votesRevealed && state.isHost) ? '' : 'none';
    if (resetBtn)  resetBtn.style.display  = ( state.votesRevealed && state.isHost) ? '' : 'none';
  }

  function renderResultBar() {
    const avgEl = $('#averageVote'); if (avgEl) avgEl.textContent = (state.averageVote != null ? String(state.averageVote) : 'N/A');
    const pre = document.querySelector('.pre-vote'); const post = document.querySelector('.post-vote');
    if (pre && post) { pre.style.display = state.votesRevealed ? 'none' : ''; post.style.display = state.votesRevealed ? '' : 'none'; }
  }

  // Buttons (aus HTML)
  window.revealCards = () => send('revealCards');
  window.resetRoom   = () => send('resetRoom');

  // Verlassen nur bei echtem Navigieren/Schließen:
  function gracefulLeave() {
    try { send('intentLeave'); } catch(_) {}
    try { state.ws && state.ws.close(4003, 'intentional leave'); } catch(_) {}
  }
  window.addEventListener('pagehide',  gracefulLeave, {capture:true});
  window.addEventListener('beforeunload', gracefulLeave, {capture:true});
  // KEIN visibilitychange mehr!

  function boot(){ console.info(TAG, 'boot'); connectWS(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
