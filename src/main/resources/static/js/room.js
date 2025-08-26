/* room.js v19 — connector for /gameSocket (CID-based, topic, host-safe) */
// Keep this file in sync with server message schema.
(() => {
  'use strict';
  const TAG = '[ROOM]';

  // --- DOM helpers ---
  const $ = (s) => document.querySelector(s);
  const setText = (sel, v) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = v ?? ''; };

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

    isHost: false,
    votesRevealed: false,
    cards: [],
    sequenceId: null,     // <— NEW: keep current server sequence
    participants: [],
    averageVote: null,

    // Topic from GameService
    topicVisible: true,
    topicLabel: '',
    topicUrl: null,

    // Auto-reveal from GameService
    autoRevealEnabled: false
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
      // Do not auto-reconnect on server-driven closures
      if (ev.code === 4000 || ev.code === 4001) return;
      setTimeout(() => { if (!state.connected) connectWS(); }, 2000);
    };
    s.onerror = (e) => console.warn(TAG, 'ERROR', e);
    s.onmessage = (ev) => {
      try { handleMessage(JSON.parse(ev.data)); }
      catch { console.warn(TAG, 'bad JSON', ev.data); }
    };

    // Intentional leave hint (2s grace server-side)
    const beforeUnload = () => { try { s.readyState === 1 && s.send('intentionalLeave'); } catch {} };
    window.addEventListener('beforeunload', beforeUnload, { once:true });
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
      case 'hostChanged': {
        // optional toast could go here
        break;
      }
      case 'kicked': {
        try { state.ws && state.ws.close(4001, 'Kicked'); } catch {}
        location.assign(m.redirect || '/');
        break;
      }
      case 'roomClosed': {
        try { state.ws && state.ws.close(4000, 'Room closed'); } catch {}
        location.assign(m.redirect || '/');
        break;
      }
      case 'voteUpdate': {
        state.cards = Array.isArray(m.cards) ? m.cards : state.cards;
        state.sequenceId = m.sequenceId || state.sequenceId;          // <— keep sequence id
        state.votesRevealed = !!m.votesRevealed;
        state.averageVote = m.averageVote ?? null;

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
        renderResultBar(m); // pass raw for extras if needed
        renderTopic();
        renderAutoReveal();
        syncMenuFromState();  // keep overlay labels/toggles in sync

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
      left.textContent = p.isHost ? '👑' : '👤';
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
        } else if (!p.disconnected && !p.observer && (p.vote == null)) {
          const hour = document.createElement('span');
          hour.className = 'status-icon pending';
          hour.textContent = '⏳';
          right.appendChild(hour);
        } else if (p.observer) {
          const eye = document.createElement('span');
          eye.className = 'status-icon observer';
          eye.textContent = '👁';
          right.appendChild(eye);
        }
      } else {
        // revealed: show vote chip or dash; observers stay with an eye
        if (p.observer) {
          const eye = document.createElement('span');
          eye.className = 'status-icon observer';
          eye.textContent = '👁';
          right.appendChild(eye);
        } else {
          const chip = document.createElement('span');
          chip.className = 'vote-chip';
          let display = (p.vote == null || p.vote === '') ? '–' : String(p.vote);
          chip.textContent = display;
          if (display === '☕' || display === '∞') chip.classList.add('special');
          right.appendChild(chip);
        }
      }

      // Host-only row actions
      if (state.isHost && !p.isHost) {
        const makeHost = document.createElement('button');
        makeHost.className = 'row-action host';
        makeHost.type = 'button';
        makeHost.innerHTML = '<span class="ra-icon">👑</span><span class="ra-label">Make host</span>';
        makeHost.addEventListener('click', () => {
          const confirmMsg = (document.documentElement.lang || 'en').startsWith('de')
            ? `Host-Rolle an ${p.name} übergeben?`
            : `Make ${p.name} the host?`;
          if (confirm(confirmMsg)) send('makeHost:' + encodeURIComponent(p.name));
        });
        right.appendChild(makeHost);

        const kick = document.createElement('button');
        kick.className = 'row-action kick';
        kick.type = 'button';
        kick.innerHTML = '<span class="ra-icon">❌</span><span class="ra-label">Kick</span>';
        kick.addEventListener('click', () => {
          const confirmMsg = (document.documentElement.lang || 'en').startsWith('de')
            ? `${p.name} wirklich entfernen?`
            : `Really remove ${p.name}?`;
          if (confirm(confirmMsg)) send('kick:' + encodeURIComponent(p.name));
        });
        right.appendChild(kick);
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

    // Split into numeric-like & specials. Infinity is a special that we *show* with numbers
    // only for sequence "fib.enh".
    const SHOW_INFINITY = (state.sequenceId === 'fib.enh');

    const specialsSet = new Set(['?', '💬', '☕']); // ∞ intentionally not here
    const numeric = [];
    const specials = [];

    for (const v of state.cards || []) {
      if (v === '∞') {
        if (SHOW_INFINITY) numeric.push(v);  // show with numbers in enhanced
        // else: completely skip ∞ in other sequences
        continue;
      }
      if (specialsSet.has(v)) specials.push(v);
      else numeric.push(v);
    }

    const me = state.participants.find(pp => pp.name === state.youName);
    const isObserver = !!(me && me.observer);
    const disabled = state.votesRevealed || isObserver;

    function addBtn(val) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(val);
      if (disabled) btn.disabled = true;
      btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`));
      grid.appendChild(btn);
    }

    numeric.forEach(addBtn);
    if (specials.length) {
      // visual break row
      const br = document.createElement('div');
      br.style.gridColumn = '1 / -1';
      br.style.height = '6px';
      grid.appendChild(br);
      specials.forEach(addBtn);
    }

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

  function renderResultBar(m) {
    const avgEl = $('#averageVote');
    if (avgEl) avgEl.textContent = (state.averageVote != null ? String(state.averageVote) : 'N/A');

    // server already decides when median/range/outliers appear; we just reflect visibility
    const medianWrap = $('#medianWrap');
    const rangeWrap  = $('#rangeWrap');
    const rangeSep   = $('#rangeSep');

    if (m && m.medianVote) { setText('#medianVote', m.medianVote); medianWrap?.removeAttribute('hidden'); }
    else { medianWrap?.setAttribute('hidden',''); }

    if (m && m.range) { setText('#rangeVote', m.range); rangeWrap?.removeAttribute('hidden'); rangeSep?.removeAttribute('hidden'); }
    else { rangeWrap?.setAttribute('hidden',''); rangeSep?.setAttribute('hidden',''); }

    const pre  = document.querySelector('.pre-vote');
    const post = document.querySelector('.post-vote');
    if (pre && post) {
      pre.style.display  = state.votesRevealed ? 'none' : '';
      post.style.display = state.votesRevealed ? '' : 'none';
    }

    // Consensus-only line rendering stays on the server decision (average text kept)
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

    const shouldShow = !!state.topicVisible;
    if (row) row.style.display = shouldShow ? '' : 'none';
    if (edit && !shouldShow) edit.style.display = 'none';
  }

  // --- auto-reveal UI ---
  function renderAutoReveal() {
    const preSt  = document.querySelector('.pre-vote #arStatus'); // may not exist anymore
    if (preSt) preSt.textContent = state.autoRevealEnabled ? 'On' : 'Off';
  }

  // --- keep overlay/menu in sync with latest state ---
  function syncMenuFromState() {
    const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');

    // Topic
    const mTgl = $('#menuTopicToggle');
    const mSt  = $('#menuTopicStatus');
    if (mTgl) {
      mTgl.checked = !!state.topicVisible;
      mTgl.setAttribute('aria-checked', String(!!state.topicVisible));
    }
    if (mSt) mSt.textContent = state.topicVisible ? (isDe ? 'An' : 'On') : (isDe ? 'Aus' : 'Off');

    // Participation
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
        const link = `${location.origin}/invite?roomCode=${encodeURIComponent(state.roomCode)}`;
        await navigator.clipboard.writeText(link);
        copyBtn.setAttribute('data-tooltip', (document.documentElement.lang || 'en').startsWith('de') ? 'Link kopiert' : 'Link copied');
      } catch {
        copyBtn.setAttribute('data-tooltip', (document.documentElement.lang || 'en').startsWith('de') ? 'Kopieren nicht möglich' : 'Copy failed');
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
        const on = !!e.target.checked;
        send(`topicToggle:${on}`);
      });
    }

    const mAR = $('#menuAutoRevealToggle');
    if (mAR) {
      mAR.addEventListener('change', (e) => {
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
