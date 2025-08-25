/* room.js v12 — stable WS + proper disconnected styling (zzz + italic) */
(() => {
  'use strict';
  const TAG = '[ROOM]';

  // ----------------- DOM helpers -----------------
  const $ = (sel) => document.querySelector(sel);
  const setText = (id, v) => { const el = typeof id === 'string' ? $(id) : id; if (el) el.textContent = v ?? ''; };

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

  // Persist a stable client id per tab
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

  // Initial UI labels
  setText('#youName', state.youName);
  setText('#roomCodeVal', state.roomCode);

  // Inject minimal CSS for disconnected look (keeps styles.css untouched)
  (function ensureDiscCss() {
    const id = 'room-disc-style';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      .p-row{display:flex;align-items:center;gap:.5rem;justify-content:space-between;padding:.35rem .6rem;border-radius:.5rem}
      .p-left{display:flex;align-items:center;gap:.5rem;min-width:0}
      .p-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .p-row.is-disconnected .p-name{font-style:italic;opacity:.75}
      .p-zz{margin-right:.15rem}
      .p-right{margin-left:1rem}
    `;
    document.head.appendChild(s);
  })();

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
    try { s = new WebSocket(u); } catch (e) { console.error(TAG, 'WebSocket ctor failed', e); return; }
    state.ws = s;

    s.onopen = () => {
      state.connected = true;
      console.info(TAG, 'OPEN');
    };

    s.onclose = (ev) => {
      state.connected = false;
      console.warn(TAG, 'CLOSE', ev.code, ev.reason || '');
      // Light retry
      setTimeout(() => { if (!state.connected) connectWS(); }, 3000);
    };

    s.onerror = (e) => console.warn(TAG, 'ERROR', e);

    s.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
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

  // Keepalive (server ignores "ping")
  let pingTimer = null;
  function startPing() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => send('ping'), 25000);
  }

  // ----------------- message handling -----------------
  function handleMessage(m) {
    switch (m.type) {
      case 'you': {
        if (m.yourName && m.yourName !== state.youName) {
          state.youName = m.yourName;
          setText('#youName', state.youName);
        }
        startPing();
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
        console.info(TAG, 'Host changed:', m.host);
        break;
      }
      case 'roomClosed': {
        alert('Room was closed by host.');
        try { state.ws && state.ws.close(4001, 'room closed'); } catch (_){}
        break;
      }
      default:
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
      li.className = 'p-row' + (p.disconnected ? ' is-disconnected' : '');

      // left side: crown, zzz, name
      const left = document.createElement('div');
      left.className = 'p-left';

      if (p.isHost) {
        const crown = document.createElement('span');
        crown.className = 'host-label';
        crown.setAttribute('title', 'Host');
        crown.textContent = '👑';
        left.appendChild(crown);
      }

      if (p.disconnected) {
        const zzz = document.createElement('span');
        zzz.className = 'p-zz';
        zzz.setAttribute('title', 'Disconnected');
        zzz.textContent = '💤';
        left.appendChild(zzz);
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'p-name';
      nameSpan.textContent = p.name;
      left.appendChild(nameSpan);

      li.appendChild(left);

      // right side: status / vote
      const right = document.createElement('span');
      right.className = 'p-right';
      if (p.disconnected) {
        right.textContent = ''; // no vote status if disconnected
      } else if (!state.votesRevealed) {
        right.textContent = (p.vote != null ? '✓' : '');
        right.title = (p.vote != null ? 'Chosen' : '');
      } else {
        right.textContent = (p.vote != null ? String(p.vote) : '–');
      }
      li.appendChild(right);

      ul.appendChild(li);
    });
  }

  function renderCards() {
    const grid = $('#cardGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const disabled = state.votesRevealed;

    state.cards.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.textContent = String(val);
      btn.disabled = !!disabled;
      btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`));
      grid.appendChild(btn);
    });

    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');
    if (revealBtn) revealBtn.style.display = (!state.votesRevealed && state.isHost) ? '' : 'none';
    if (resetBtn)  resetBtn.style.display  = ( state.votesRevealed && state.isHost) ? '' : 'none';
  }

  function renderResultBar() {
    const avgEl = $('#averageVote');
    if (avgEl) avgEl.textContent = (state.averageVote != null ? String(state.averageVote) : 'N/A');

    const pre  = document.querySelector('.pre-vote');
    const post = document.querySelector('.post-vote');
    if (pre && post) {
      pre.style.display  = state.votesRevealed ? 'none' : '';
      post.style.display = state.votesRevealed ? '' : 'none';
    }
  }

  // ----------------- public actions -----------------
  function revealCards() { send('revealCards'); }
  function resetRoom()   { send('resetRoom'); }
  window.revealCards = revealCards;
  window.resetRoom   = resetRoom;

  // ----------------- boot -----------------
  function wireToggles() {
    const part = $('#participationToggle');
    if (part) {
      part.addEventListener('change', (e) => {
        const on = !!e.target.checked;
        const label = $('#partStatus');
        if (label) label.textContent = on ? "I'm estimating" : "Observer";
        send('setParticipating:' + on);
      });
    }
  }

  function boot() {
    console.info(TAG, 'boot');
    connectWS();
    wireToggles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
