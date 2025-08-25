/* room.js v9 — minimal, robust connector for /gameSocket */
(() => {
  'use strict';
  const TAG = '[ROOM]';

  // ----------------- DOM helpers -----------------
  const $ = (sel) => document.querySelector(sel);
  const setText = (id, v) => { const el = typeof id === 'string' ? $(id) : id; if (el) el.textContent = v ?? ''; };
  const show = (el, on) => { (typeof el === 'string' ? $(el) : el).style.display = on ? '' : 'none'; };

  // ----------------- state -----------------
  const scriptEl = document.querySelector('script[src*="/room.js"]');
  const ds = (scriptEl && scriptEl.dataset) || {};
  const url = new URL(location.href);
  const state = {
    roomCode: ds.room || url.searchParams.get('roomCode') || 'demo',
    youName: ds.participant || url.searchParams.get('participantName') || 'Guest',
    cid: null,
    ws: null,
    connected: false,
    isHost: false,
    votesRevealed: false,
    cards: [],
    participants: [],
    averageVote: null
  };

  // persist a stable client id per tab
  const CIDKEY = 'ep-cid';
  try {
    state.cid = sessionStorage.getItem(CIDKEY);
    if (!state.cid) {
      state.cid = Math.random().toString(36).slice(2) + '-' + Date.now();
      sessionStorage.setItem(CIDKEY, state.cid);
    }
  } catch (_) {
    state.cid = 'cid-' + Date.now();
  }

  // Set initial UI texts
  setText('#youName', state.youName);
  setText('#roomCodeVal', state.roomCode);

  // ----------------- WS connect -----------------
  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return (
      proto + location.host +
      '/gameSocket?roomCode=' + encodeURIComponent(state.roomCode) +
      '&participantName=' + encodeURIComponent(state.youName) +
      '&cid=' + encodeURIComponent(state.cid)
    );
  }

  function connectWS() {
    const u = wsUrl();
    console.info(TAG, 'connecting WS →', u);
    let s;
    try {
      s = new WebSocket(u);
    } catch (e) {
      console.error(TAG, 'WebSocket ctor failed', e);
      return;
    }
    state.ws = s;

    s.onopen = () => {
      state.connected = true;
      console.info(TAG, 'OPEN');
    };

    s.onclose = (ev) => {
      state.connected = false;
      console.warn(TAG, 'CLOSE', ev.code, ev.reason || '');
      // Optional: light retry after short delay
      setTimeout(() => { if (!state.connected) connectWS(); }, 3000);
    };

    s.onerror = (e) => console.warn(TAG, 'ERROR', e);

    s.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        // console.debug(TAG, 'MSG', msg);
        handleMessage(msg);
      } catch (e) {
        console.warn(TAG, 'bad JSON', ev.data);
      }
    };
  }

  function send(line) {
    if (state.ws && state.ws.readyState === 1) {
      state.ws.send(line);
    } else {
      console.warn(TAG, 'send skipped (ws not open):', line);
    }
  }

  // ----------------- message handling -----------------
  function handleMessage(m) {
    switch (m.type) {
      case 'you': {
        // server confirms canonical name / cid
        if (m.yourName && m.yourName !== state.youName) {
          state.youName = m.yourName;
          setText('#youName', state.youName);
        }
        break;
      }
      case 'voteUpdate': {
        state.cards = Array.isArray(m.cards) ? m.cards : state.cards;
        state.votesRevealed = !!m.votesRevealed;
        state.averageVote = m.averageVote ?? null;
        state.participants = Array.isArray(m.participants) ? m.participants : [];

        // are we host?
        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);

        renderCards();
        renderParticipants();
        renderResultBar();
        break;
      }
      case 'hostChanged': {
        // optional toast/log; state will refresh on next voteUpdate
        console.info(TAG, 'Host changed:', m.host);
        break;
      }
      case 'roomClosed': {
        console.warn(TAG, 'Room closed');
        alert('Room was closed by host.');
        try { state.ws && state.ws.close(4001, 'room closed'); } catch (_){}
        break;
      }
      default:
        // ignore
        break;
    }
  }

  // ----------------- UI rendering -----------------
  function renderParticipants() {
    const ul = $('#liveParticipantList');
    if (!ul) return;
    ul.innerHTML = '';

    state.participants.forEach(p => {
      const li = document.createElement('li');
      li.className = 'p-row';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'p-name';
      nameSpan.textContent = p.name;

      // host crown
      if (p.isHost) {
        const crown = document.createElement('span');
        crown.className = 'host-label';
        crown.setAttribute('title', 'Host');
        crown.textContent = ' 👑 ';
        li.appendChild(crown);
      }

      li.appendChild(nameSpan);

      // status / vote
      const status = document.createElement('span');
      status.className = 'p-status';
      if (p.disconnected) {
        status.textContent = ' 🚪';
        status.title = 'Disconnected';
      } else if (!state.votesRevealed) {
        // before reveal: only checkmark if a card chosen
        status.textContent = (p.vote != null ? ' ✓' : '');
        status.title = (p.vote != null ? 'Chosen' : '');
      } else {
        // after reveal: show value (including specials)
        status.textContent = (p.vote != null ? `  ${p.vote}` : '  –');
      }
      li.appendChild(status);

      ul.appendChild(li);
    });
  }

  function renderCards() {
    const grid = $('#cardGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Disable voting after reveal
    const disabled = state.votesRevealed;

    state.cards.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.textContent = String(val);
      btn.disabled = !!disabled;

      btn.addEventListener('click', () => {
        // send "vote:<name>:<value>"
        send(`vote:${state.youName}:${val}`);
      });

      grid.appendChild(btn);
    });

    // Reveal/Reset buttons visibility
    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');
    if (revealBtn) revealBtn.style.display = (!state.votesRevealed && state.isHost) ? '' : 'none';
    if (resetBtn)  resetBtn.style.display  = ( state.votesRevealed && state.isHost) ? '' : 'none';
  }

  function renderResultBar() {
    const avg = state.averageVote;
    const avgEl = $('#averageVote');
    if (avgEl) {
      avgEl.textContent = (avg != null ? String(avg) : 'N/A');
    }

    // Show pre-/post-vote blocks
    const pre  = document.querySelector('.pre-vote');
    const post = document.querySelector('.post-vote');
    if (pre && post) {
      pre.style.display  = state.votesRevealed ? 'none' : '';
      post.style.display = state.votesRevealed ? '' : 'none';
    }
  }

  // ----------------- public actions (called from HTML onclick) -----------------
  function revealCards() {
    send('revealCards');
  }
  function resetRoom() {
    send('resetRoom');
  }
  // expose
  window.revealCards = revealCards;
  window.resetRoom   = resetRoom;

  // ----------------- boot -----------------
  function boot() {
    console.info(TAG, 'boot');
    connectWS();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

