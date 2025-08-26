/* room.js v15 — robust connector for /gameSocket (CID-based, host-safe, sequence sync) */
(() => {
  'use strict';
  const TAG = '[ROOM]';

  // --- DOM helpers ---
  const $ = (s) => document.querySelector(s);
  const setText = (sel, v) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = v ?? ''; };
  const setDisabled = (elOrSel, on) => {
    const el = typeof elOrSel === 'string' ? $(elOrSel) : elOrSel;
    if (!el) return;
    if (on) el.setAttribute('disabled', 'true'); else el.removeAttribute('disabled');
    // add/remove .disabled on typical wrappers
    const row = el.closest('.menu-item, .radio-row');
    if (row) row.classList.toggle('disabled', !!on);
  };

  // --- state ---
  const scriptEl = document.querySelector('script[src*="/js/room.js"]');
  const ds = (scriptEl && scriptEl.dataset) || {};
  const url = new URL(location.href);

  const state = {
    roomCode: ds.room || url.searchParams.get('roomCode') || 'demo',
    youName:  ds.participant || url.searchParams.get('participantName') || 'Guest',
    cid: null,
    ws: null,
    connected: false,
    noReconnect: false,

    isHost: false,
    votesRevealed: false,
    cards: [],
    participants: [],
    averageVote: null,
    medianVote: null,
    rangeText: null,
    consensus: false,

    // Topic from GameService
    topicVisible: true,
    topicLabel: '',
    topicUrl: null,

    // Auto-reveal from GameService
    autoRevealEnabled: false,

    // Sequence
    sequenceId: 'fib.scrum'
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
      // Do not reconnect on intentional closes (room closed / kicked) or if we already redirected
      if (state.noReconnect || ev.code === 4000 || ev.code === 4001) return;
      setTimeout(() => { if (!state.connected && !state.noReconnect) connectWS(); }, 2000);
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
        if (m.cid && m.cid !== state.cid) {
          state.cid = m.cid;
          try { sessionStorage.setItem(CIDKEY, state.cid); } catch {}
        }
        break;
      }
      case 'voteUpdate': {
        state.cards = Array.isArray(m.cards) ? m.cards : state.cards;
        state.votesRevealed = !!m.votesRevealed;
        state.averageVote = m.averageVote ?? null;
        state.medianVote  = m.medianVote ?? null;
        state.rangeText   = m.range ?? null;
        state.consensus   = !!m.consensus;
        state.sequenceId  = m.sequenceId || state.sequenceId;

        const raw = Array.isArray(m.participants) ? m.participants : [];
        state.participants = raw.map(p => ({ ...p, observer: p.participating === false }));

        state.topicVisible = !!m.topicVisible;
        state.topicLabel   = m.topicLabel || '';
        state.topicUrl     = m.topicUrl || null;

        state.autoRevealEnabled = !!m.autoRevealEnabled;

        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);

        renderParticipants();
        renderCards();
        renderResultBar();
        renderTopic();
        renderAutoReveal();
        syncMenuFromState();  // keep overlay labels/toggles/radios in sync
        break;
      }
      case 'roomClosed': {
        // Server asks us to leave; redirect path provided
        const redirect = m.redirect || '/';
        state.noReconnect = true;
        try { state.ws && state.ws.close(4000, 'Room closed'); } catch {}
        location.href = redirect;
        break;
      }
      case 'kicked': {
        const redirect = m.redirect || '/';
        state.noReconnect = true;
        try { state.ws && state.ws.close(4001, 'Kicked'); } catch {}
        location.href = redirect;
        break;
      }
      case 'hostChanged': {
        // Optional: could toast; we just resync via subsequent voteUpdate
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

      const left = document.createElement('span');
      left.className = 'participant-icon';
      if (p.isHost) { left.classList.add('host'); left.textContent = '👑'; }
      else if (p.disconnected) { left.classList.add('inactive'); left.textContent = '💤'; }
      else if (p.observer) { left.textContent = '👁'; }
      else { left.textContent = ''; }
      li.appendChild(left);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      li.appendChild(name);

      const right = document.createElement('div');
      right.className = 'row-right';

      if (!state.votesRevealed) {
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

    const me = state.participants.find(pp => pp.name === state.youName);
    const isObserver = !!(me && me.observer);
    const disabled = state.votesRevealed || isObserver;

    state.cards.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(val);
      if (disabled) btn.disabled = true;
      btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`)); // name is stable mapping on server
      grid.appendChild(btn);
    });

    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');
    if (revealBtn) revealBtn.style.display = (!state.votesRevealed && state.isHost) ? '' : 'none';
    if (resetBtn)  resetBtn.style.display  = ( state.votesRevealed && state.isHost) ? '' : 'none';

    const partStatus = $('#partStatus');
    if (partStatus && me) {
      partStatus.textContent = !isObserver
        ? (document.documentElement.lang === 'de' ? 'Ich schätze mit' : "I'm estimating")
        : (document.documentElement.lang === 'de' ? 'Beobachter:in' : 'Observer');
    }
  }

  function renderResultBar() {
    const avgEl = $('#averageVote');
    if (avgEl) avgEl.textContent = (state.averageVote != null ? String(state.averageVote) : 'N/A');

    const medianWrap = $('#medianWrap');
    const medianEl   = $('#medianVote');
    const rangeWrap  = $('#rangeWrap');
    const rangeSep   = $('#rangeSep');

    const pre  = document.querySelector('.pre-vote');
    const post = document.querySelector('.post-vote');
    if (pre && post) {
      pre.style.display  = state.votesRevealed ? 'none' : '';
      post.style.display = state.votesRevealed ? '' : 'none';
    }

    if (state.votesRevealed) {
      if (medianWrap && medianEl) {
        if (state.medianVote) {
          medianEl.textContent = state.medianVote;
          medianWrap.hidden = false;
        } else {
          medianWrap.hidden = true;
        }
      }
      if (rangeWrap) {
        if (state.rangeText) {
          setText('#rangeVote', state.rangeText);
          rangeWrap.hidden = false;
          if (rangeSep) rangeSep.hidden = false;
        } else {
          rangeWrap.hidden = true;
          if (rangeSep) rangeSep.hidden = true;
        }
      }
    } else {
      if (medianWrap) medianWrap.hidden = true;
      if (rangeWrap)  rangeWrap.hidden  = true;
      if (rangeSep)   rangeSep.hidden   = true;
    }
  }

  // --- topic UI ---
  function renderTopic() {
    const row = $('#topicRow');
    const edit = $('#topicEdit');
    const disp = $('#topicDisplay');

    if (disp) {
      if (state.topicLabel && state.topicUrl) {
        disp.innerHTML = `<a href="${encodeURI(state.topicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.topicLabel)}</a>`;
      } else if (state.topicLabel) {
        disp.textContent = state.topicLabel;
      } else {
        disp.textContent = '—';
      }
    }

    // Visibility + host-only actions
    const shouldShow = !!state.topicVisible;
    if (row) {
      row.style.display = shouldShow ? '' : 'none';
      const actions = row.querySelector('.topic-actions');
      if (actions) actions.style.display = state.isHost ? '' : 'none';
    }
    if (edit) {
      if (!shouldShow) edit.style.display = 'none';
      if (!state.isHost && edit.style.display !== 'none') {
        // If we lost host while editing, close editor
        edit.style.display = 'none';
        if (row) row.style.display = shouldShow ? '' : 'none';
      }
    }
  }

  // --- auto-reveal UI ---
  function renderAutoReveal() {
    // Status text (overlay + keep any pre-vote mirrors if later reintroduced)
    const menuSt = $('#menuArStatus');
    const statusText = state.autoRevealEnabled ? 'On' : 'Off';
    if (menuSt) menuSt.textContent = statusText;
  }

  // --- keep overlay/menu in sync with latest state ---
  function syncMenuFromState() {
    const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');

    // Topic toggle (overlay)
    const mTgl = $('#menuTopicToggle');
    const mSt  = $('#menuTopicStatus');
    if (mTgl) {
      mTgl.checked = !!state.topicVisible;
      mTgl.setAttribute('aria-checked', String(!!state.topicVisible));
    }
    if (mSt) mSt.textContent = state.topicVisible ? (isDe ? 'An' : 'On') : (isDe ? 'Aus' : 'Off');

    // Participation status text in overlay
    const me = state.participants.find(p => p.name === state.youName);
    const isObserver = !!(me && me.observer);
    const mPTgl = $('#menuParticipationToggle');
    const mPSt  = $('#menuPartStatus');
    if (mPTgl) {
      mPTgl.checked = !isObserver;
      mPTgl.setAttribute('aria-checked', String(!isObserver));
    }
    if (mPSt) mPSt.textContent = !isObserver ? (isDe ? 'Ich schätze mit' : "I'm estimating")
                                            : (isDe ? 'Beobachter:in' : 'Observer');

    // Auto-reveal (menu toggle)
    const mARTgl = $('#menuAutoRevealToggle');
    if (mARTgl) {
      mARTgl.checked = !!state.autoRevealEnabled;
      mARTgl.setAttribute('aria-checked', String(!!state.autoRevealEnabled));
    }

    // Sequence radios (overlay)
    const seqRoot = $('#menuSeqChoice');
    if (seqRoot) {
      const all = seqRoot.querySelectorAll('input[type="radio"][name="menu-seq"]');
      all.forEach(r => { r.checked = (r.value === state.sequenceId); });
    }

    // Host locks (disable host-only controls for non-host)
    const hostOnly = !state.isHost;
    // Auto-reveal & topic visibility are host-only
    setDisabled('#menuAutoRevealToggle', hostOnly);
    setDisabled('#menuTopicToggle',      hostOnly);
    // Sequence radios host-only
    if (seqRoot) {
      seqRoot.querySelectorAll('input[type="radio"]').forEach(r => setDisabled(r, hostOnly));
    }

    // Host-only hints visibility
    const seqHint = $('#menuSeqHint');
    const arHint  = $('#menuArHint');
    const topicHint = $('#menuTopicToggleHint');
    if (seqHint)  seqHint.style.display  = hostOnly ? '' : 'none';
    if (arHint)   arHint.style.display   = hostOnly ? '' : 'none';
    if (topicHint)topicHint.style.display= hostOnly ? '' : 'none';
  }

  // --- actions exposed for HTML buttons ---
  function revealCards() { send('revealCards'); }
  function resetRoom()   { send('resetRoom'); }
  window.revealCards = revealCards;
  window.resetRoom   = resetRoom;

  // --- menu / toggles wiring (once) ---
  function wireOnce() {
    // copy link
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

    // participation switch (pre-vote row)
    const partToggle = $('#participationToggle');
    if (partToggle) {
      partToggle.addEventListener('change', (e) => {
        const estimating = !!e.target.checked;
        send(`participation:${estimating}`);
      });
    }

    // topic edit/save/clear (host-only guarded)
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
        if (input) { input.value = state.topicLabel || ''; input.focus(); }
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

    // --- MENU toggles (namespaced) ---
    const mPart = $('#menuParticipationToggle');
    if (mPart) {
      mPart.addEventListener('change', (e) => {
        const estimating = !!e.target.checked;
        send(`participation:${estimating}`);
      });
    }

    const mTopic = $('#menuTopicToggle');
    if (mTopic) {
      mTopic.addEventListener('change', (e) => {
        if (!state.isHost) { syncMenuFromState(); return; } // guard + reset UI
        const on = !!e.target.checked;
        send(`topicToggle:${on}`);
      });
    }

    const mAR = $('#menuAutoRevealToggle');
    if (mAR) {
      mAR.addEventListener('change', (e) => {
        if (!state.isHost) { syncMenuFromState(); return; } // guard + reset UI
        const on = !!e.target.checked;
        send(`autoReveal:${on}`);
      });
    }

    // menu: close room event (from menu.js)
    document.addEventListener('ep:close-room', () => {
      if (!state.isHost) return;
      const de  = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
      const msg = de ? 'Diesen Raum für alle schließen?' : 'Close this room for everyone?';
      if (confirm(msg)) send('closeRoom');
    });

    // menu: sequence change bridge (from menu.js)
    document.addEventListener('ep:sequence-change', (e) => {
      const id = e && e.detail && e.detail.id;
      if (!id) return;
      if (!state.isHost) { syncMenuFromState(); return; }
      send('sequence:' + id);
    });
  }

  // --- utils ---
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
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
