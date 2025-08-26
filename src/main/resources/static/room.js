/* room.js v12 — robust connector for /gameSocket (CID-based, topic, host-safe) */
(() => {
  'use strict';
  const TAG = '[ROOM]';

  // --- DOM helpers ---
  const $ = (s) => document.querySelector(s);
  const setText = (sel, v) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = v ?? ''; };

  // --- state ---
  const scriptEl = document.querySelector('script[src*="/room.js"]');
  const ds = (scriptEl && scriptEl.dataset) || {};
  const url = new URL(location.href);

  const state = {
    roomCode: ds.room || url.searchParams.get('roomCode') || 'demo',
    youName:  ds.participant || url.searchParams.get('participantName') || 'Guest',
    cid: null,
    ws: null,
    connected: false,

    isHost: false,
    votesRevealed: false,
    cards: [],
    participants: [],
    averageVote: null,

    topicEnabled: true,
    topic: ''
  };

  // stable per-tab client id
  const CIDKEY = 'ep-cid';
  try {
    state.cid = sessionStorage.getItem(CIDKEY);
    if (!state.cid) {
      state.cid = Math.random().toString(36).slice(2) + '-' + Date.now();
      sessionStorage.setItem(CIDKEY, state.cid);
    }
  } catch { state.cid = 'cid-' + Date.now(); }

  // init UI labels
  setText('#youName', state.youName);
  setText('#roomCodeVal', state.roomCode);

  // --- ws url ---
  const wsUrl = () => {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return `${proto}${location.host}/gameSocket` +
      `?roomCode=${encodeURIComponent(state.roomCode)}` +
      `&participantName=${encodeURIComponent(state.youName)}` +
      `&cid=${encodeURIComponent(state.cid)}`;
  };

  // --- connect ---
  function connectWS() {
    const u = wsUrl();
    console.info(TAG, 'connect →', u);
    let s;
    try { s = new WebSocket(u); } catch (e) { console.error(TAG, e); return; }
    state.ws = s;

    s.onopen = () => {
      state.connected = true;
      console.info(TAG, 'OPEN');
      heartbeat();
    };
    s.onclose = (ev) => {
      state.connected = false;
      console.warn(TAG, 'CLOSE', ev.code, ev.reason || '');
      stopHeartbeat();
      setTimeout(() => { if (!state.connected) connectWS(); }, 2000);
    };
    s.onerror = (e) => console.warn(TAG, 'ERROR', e);
    s.onmessage = (ev) => {
      try { handleMessage(JSON.parse(ev.data)); }
      catch { console.warn(TAG, 'bad JSON', ev.data); }
    };
  }

  function send(line) {
    if (state.ws && state.ws.readyState === 1) {
      state.ws.send(line);
    }
  }

  // --- heartbeat (keeps lastSeen fresh for host stickiness) ---
  let hbT = null;
  function heartbeat() {
    stopHeartbeat();
    hbT = setInterval(() => send('ping'), 25000);
  }
  function stopHeartbeat() {
    if (hbT) { clearInterval(hbT); hbT = null; }
  }

  // --- messages ---
  function handleMessage(m) {
    switch (m.type) {
      case 'you': {
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

        // topic
        state.topicEnabled = !!m.topicEnabled;
        state.topic = m.topic || '';

        // are we host?
        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);

        renderParticipants();
        renderCards();
        renderResultBar();
        renderTopic();

        break;
      }
      default: break;
    }
  }

  // --- participants UI ---
  function renderParticipants() {
    const ul = $('#liveParticipantList');
    if (!ul) return;
    ul.innerHTML = '';

    state.participants.forEach(p => {
      const li = document.createElement('li');
      li.className = 'participant-row';
      if (p.disconnected) li.classList.add('disconnected');

      // left icon
      const left = document.createElement('span');
      left.className = 'participant-icon';
      if (p.isHost) { left.classList.add('host'); left.textContent = '👑'; }
      else if (p.disconnected) { left.classList.add('inactive'); left.textContent = '💤'; }
      else if (p.observer) { left.textContent = '👁'; }
      else { left.textContent = ''; }
      li.appendChild(left);

      // name
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      li.appendChild(name);

      // right block (status/vote)
      const right = document.createElement('div');
      right.className = 'row-right';

      if (!state.votesRevealed) {
        // checkmark if chosen and connected
        if (!p.disconnected && !p.observer && p.vote != null) {
          const done = document.createElement('span');
          done.className = 'status-icon done';
          done.textContent = '✓';
          right.appendChild(done);
        } else if (p.observer) {
          const eye = document.createElement('span');
          eye.className = 'status-icon observer';
          eye.textContent = '👁';
          right.appendChild(eye);
        }
      } else {
        // show value chip (or dash)
        const chip = document.createElement('span');
        chip.className = 'vote-chip';
        let display = (p.vote == null || p.vote === '') ? '–' : String(p.vote);
        chip.textContent = display;
        if (display === '☕' || display === '∞') chip.classList.add('special');
        right.appendChild(chip);
      }

      li.appendChild(right);
      ul.appendChild(li);
    });
  }

  // --- cards UI ---
  function renderCards() {
    const grid = $('#cardGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const disabled = state.votesRevealed || (state.participants.find(pp => pp.name === state.youName)?.observer);

    state.cards.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(val);
      if (disabled) btn.disabled = true;
      btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`));
      grid.appendChild(btn);
    });

    // host actions visibility
    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');
    if (revealBtn) revealBtn.style.display = (!state.votesRevealed && state.isHost) ? '' : 'none';
    if (resetBtn)  resetBtn.style.display  = ( state.votesRevealed && state.isHost) ? '' : 'none';

    // participation toggle label
    const partStatus = $('#partStatus');
    const me = state.participants.find(p => p.name === state.youName);
    if (partStatus && me) {
      partStatus.textContent = me && !me.observer ? (document.documentElement.lang === 'de' ? 'Ich schätze mit' : "I'm estimating")
                                                  : (document.documentElement.lang === 'de' ? 'Beobachter:in' : 'Observer');
    }
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

  // --- topic UI ---
  function renderTopic() {
    const row = $('#topicRow');
    const edit = $('#topicEdit');
    const disp = $('#topicDisplay');
    const toggle = $('#topicToggle');
    const status = $('#topicStatus');

    if (toggle) {
      toggle.checked = !!state.topicEnabled;
      toggle.setAttribute('aria-checked', String(!!state.topicEnabled));
    }
    if (status) status.textContent = state.topicEnabled ? 'On' : 'Off';

    const hasText = !!(state.topic && state.topic.trim().length > 0);
    if (disp) disp.textContent = hasText ? state.topic : '—';

    // visible only if enabled
    const shouldShow = !!state.topicEnabled;
    if (row) row.style.display = shouldShow ? '' : 'none';
    if (edit && !shouldShow) edit.style.display = 'none';
  }

  // --- actions exposed for HTML buttons ---
  function revealCards() { send('revealCards'); }
  function resetRoom()   { send('resetRoom'); }
  window.revealCards = revealCards;
  window.resetRoom   = resetRoom;

  // --- menu and toggles wiring (once) ---
  function wireOnce() {
    // copy link button
    const copyBtn = $('#copyRoomLink');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      try {
        const link = `${location.origin}/room?participantName=${encodeURIComponent(state.youName)}&roomCode=${encodeURIComponent(state.roomCode)}`;
        await navigator.clipboard.writeText(link);
        copyBtn.setAttribute('data-tooltip', document.documentElement.lang === 'de' ? 'Link kopiert' : 'Link copied');
      } catch {
        copyBtn.setAttribute('data-tooltip', document.documentElement.lang === 'de' ? 'Kopieren nicht möglich' : 'Copy failed');
      }
    });

    // participation switch
    const partToggle = $('#participationToggle');
    if (partToggle) {
      partToggle.addEventListener('change', (e) => {
        const estimating = !!e.target.checked;
        send(`participation:${estimating}`);
      });
    }

    // topic toggle
    const topicToggle = $('#topicToggle');
    if (topicToggle) {
      topicToggle.addEventListener('change', (e) => {
        const on = !!e.target.checked;
        send(`topicToggle:${on}`);
      });
    }

    // topic edit/save/clear
    const editBtn = $('#topicEditBtn');
    const clearBtn = $('#topicClearBtn');
    const editBox = $('#topicEdit');
    const row = $('#topicRow');
    const input = $('#topicInput');
    const saveBtn = $('#topicSaveBtn');
    const cancelBtn = $('#topicCancelBtn');

    if (editBtn && editBox && row) {
      editBtn.addEventListener('click', () => {
        if (!state.isHost) return;
        editBox.style.display = '';
        row.style.display = 'none';
        if (input) { input.value = state.topic || ''; input.focus(); }
      });
    }
    if (cancelBtn && editBox) {
      cancelBtn.addEventListener('click', () => {
        editBox.style.display = 'none';
        $('#topicRow').style.display = '';
      });
    }
    if (saveBtn && input) {
      saveBtn.addEventListener('click', () => {
        if (!state.isHost) return;
        const val = input.value || '';
        send('topicSave:' + encodeURIComponent(val));
        editBox.style.display = 'none';
        $('#topicRow').style.display = '';
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!state.isHost) return;
        send('topicClear');
      });
    }
  }

  // --- boot ---
  function boot() {
    wireOnce();
    connectWS();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
