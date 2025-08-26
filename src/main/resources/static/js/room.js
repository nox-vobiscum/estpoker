/* room.js v20 — WS connector & UI sync (CID-based, topic visibility, consensus-only bar) */
(() => {
  'use strict';
  const TAG = '[ROOM]';

  // --- DOM helpers ---
  const $ = (s) => document.querySelector(s);
  const setText = (sel, v) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = v ?? ''; };

  // --- toast utility (small, unobtrusive) ---
  function showToast(msg){
    try{
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(()=>{ t.remove(); }, 3000);
    }catch(_){}
  }

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
    sequenceId: null,
    participants: [],
    averageVote: null,
    medianVote: null,
    rangeText: null,
    consensus: false,
    outliers: [],

    // Topic from GameService
    topicVisible: false,
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
      // Avoid reconnect after server-initiated room close/kick
      if (ev.code === 4000 || ev.code === 4001) { state.noReconnect = true; return; }
      if (!state.noReconnect) setTimeout(() => { if (!state.connected) connectWS(); }, 2000);
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
    hbT = setInterval(() => send('ping'), 25000); // keep logically active
  }
  function stopHeartbeat() {
    if (hbT) { clearInterval(hbT); hbT = null; }
  }

  // Send intentional leave on unload (best-effort)
  window.addEventListener('pagehide', () => {
    try { if (state.ws && state.ws.readyState === 1) state.ws.send('intentionalLeave'); } catch(_){}
  });

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
        state.sequenceId = m.sequenceId || state.sequenceId;
        state.votesRevealed = !!m.votesRevealed;

        const raw = Array.isArray(m.participants) ? m.participants : [];
        state.participants = raw.map(p => ({
          ...p,
          observer: p.participating === false
        }));

        state.averageVote = m.averageVote ?? null;
        state.medianVote  = m.medianVote ?? null;
        state.rangeText   = m.range ?? null;
        state.consensus   = !!m.consensus;
        state.outliers    = Array.isArray(m.outliers) ? m.outliers : [];

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
        syncMenuFromState();  // keep overlay labels/toggles in sync
        break;
      }
      case 'hostChanged': {
        const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
        showToast(de ? `Host gewechselt zu ${m.newHost}` : `Host changed to ${m.newHost}`);
        break;
      }
      case 'roomClosed': {
        state.noReconnect = true;
        const to = m.redirect || '/';
        location.href = to;
        break;
      }
      case 'kicked': {
        state.noReconnect = true;
        const to = m.redirect || '/';
        location.href = to;
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
      if (p.isHost) li.classList.add('is-host');

      // Left icon: crown for host, person silhouette for everyone else (sleep if disconnected)
      const left = document.createElement('span');
      left.className = 'participant-icon';
      if (p.isHost) { left.classList.add('host'); left.textContent = '👑'; }
      else if (p.disconnected) { left.classList.add('inactive'); left.textContent = '💤'; }
      else { left.textContent = '👤'; }
      li.appendChild(left);

      // Name
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      li.appendChild(name);

      // Right side: status / actions
      const right = document.createElement('div');
      right.className = 'row-right';

      if (!state.votesRevealed) {
        if (p.observer) {
          const eye = document.createElement('span');
          eye.className = 'status-icon observer';
          eye.textContent = '👁';
          right.appendChild(eye);
        } else if (!p.disconnected && (p.vote == null || p.vote === '')) {
          const pend = document.createElement('span');
          pend.className = 'status-icon pending';
          pend.textContent = '⌛';
          right.appendChild(pend);
        } else if (!p.disconnected && !p.observer && p.vote != null) {
          const done = document.createElement('span');
          done.className = 'status-icon done';
          done.textContent = '✓';
          right.appendChild(done);
        }
      } else {
        const chip = document.createElement('span');
        chip.className = 'vote-chip';
        let display = (p.vote == null || p.vote === '') ? '–' : String(p.vote);
        chip.textContent = display;

        // Gray out observers / disconnected
        if (p.observer || p.disconnected) chip.classList.add('special');

        // Specials
        if (display === '☕' || display === '💬' || display === '❓') chip.classList.add('special');

        // Highlight outliers
        if (state.outliers && state.outliers.indexOf(p.name) >= 0) chip.classList.add('outlier');

        chip.setAttribute('data-val', display);
        right.appendChild(chip);
      }

      // Host tools: make host / kick (visible only if YOU are host and target != you)
      if (state.isHost && p.name !== state.youName) {
        const makeHost = document.createElement('button');
        makeHost.type = 'button';
        makeHost.className = 'row-action host';
        makeHost.innerHTML = `<span class="ra-icon">👑</span><span class="ra-label">Host</span>`;
        makeHost.addEventListener('click', () => {
          const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
          const ok = confirm(de ? `Host-Rolle an ${p.name} übergeben?` : `Make ${p.name} the host?`);
          if (ok) send('makeHost:' + encodeURIComponent(p.name));
        });
        right.appendChild(makeHost);

        const kick = document.createElement('button');
        kick.type = 'button';
        kick.className = 'row-action kick';
        kick.innerHTML = `<span class="ra-icon">❌</span><span class="ra-label">Kick</span>`;
        kick.addEventListener('click', () => {
          const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
          const ok = confirm(de ? `${p.name} aus dem Raum entfernen?` : `Remove ${p.name} from the room?`);
          if (ok) send('kick:' + encodeURIComponent(p.name));
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

    // Split numbers vs specials; Infinity is numeric for fib.enh (UI-only).
    const seqId = state.sequenceId || '';
    const specials = ['❓','💬','☕'];
    const isInfinityNumeric = seqId === 'fib.enh';
    const nums = [];
    const extras = [];
    state.cards.forEach(val => {
      if (specials.includes(val)) { extras.push(val); }
      else if (val === '∞' && !isInfinityNumeric) { extras.push(val); }
      else { nums.push(val); }
    });

    const me = state.participants.find(pp => pp.name === state.youName);
    const isObserver = !!(me && me.observer);
    const disabled = state.votesRevealed || isObserver;

    function addRow(values){
      const rowWrap = document.createElement('div');
      rowWrap.className = 'card-row';
      values.forEach(val => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(val);
        if (disabled) btn.disabled = true;
        btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`));
        rowWrap.appendChild(btn);
      });
      grid.appendChild(rowWrap);
    }

    if (nums.length) addRow(nums);
    if (extras.length) addRow(extras);

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
    const medianWrap = $('#medianWrap');
    const rangeWrap  = $('#rangeWrap');
    const rangeSep   = $('#rangeSep');
    const resultRow  = $('#resultRow');
    const resultLabel = $('#resultLabel');

    // Consensus-only display
    if (state.consensus) {
      if (resultRow) resultRow.classList.add('consensus');
      if (resultLabel) resultLabel.textContent =
        (document.documentElement.lang === 'de' ? '🎉 Konsens' : '🎉 Consensus');
      if (avgEl) avgEl.textContent = (state.averageVote != null ? String(state.averageVote) : '–');

      // hide rest
      if (medianWrap) medianWrap.hidden = true;
      if (rangeWrap)  rangeWrap.hidden = true;
      if (rangeSep)   rangeSep.hidden = true;
      return;
    }

    // Non-consensus: show average + optional stats
    if (resultRow) resultRow.classList.remove('consensus');
    if (resultLabel) resultLabel.textContent =
      (document.documentElement.lang === 'de' ? 'Durchschnitt' : 'Average');
    if (avgEl) avgEl.textContent = (state.averageVote != null ? String(state.averageVote) : '–');

    const showMed = !!state.medianVote;
    const showRng = !!state.rangeText;

    if (medianWrap) {
      medianWrap.hidden = !showMed;
      $('#medianVote') && ($('#medianVote').textContent = showMed ? String(state.medianVote) : '–');
    }
    if (rangeWrap) {
      rangeWrap.hidden = !showRng;
      $('#rangeVote') && ($('#rangeVote').textContent = showRng ? String(state.rangeText) : '–');
    }
    if (rangeSep) rangeSep.hidden = !(showMed && showRng);
  }

  // --- topic UI ---
  function renderTopic() {
    const row = $('#topicRow');
    const edit = $('#topicEdit');
    const disp = $('#topicDisplay');
    const toggle = $('#topicToggle');
    const status = $('#topicStatus');

    if (toggle) {
      toggle.checked = !!state.topicVisible;
      toggle.setAttribute('aria-checked', String(!!state.topicVisible));
    }
    if (status) status.textContent = state.topicVisible ? 'On' : 'Off';

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
    // Pre-vote toggle
    const tgl = $('#autoRevealToggle');
    if (tgl) {
      tgl.checked = !!state.autoRevealEnabled;
      tgl.setAttribute('aria-checked', String(!!state.autoRevealEnabled));
    }

    // Status text (both in pre-vote row and in menu overlay if present)
    const preSt  = document.querySelector('.pre-vote #arStatus');
    const menuSt = document.querySelector('#appMenuOverlay #menuArStatus, #appMenuOverlay #arStatus');
    const statusText = state.autoRevealEnabled ? 'On' : 'Off';
    if (preSt)  preSt.textContent = statusText;
    if (menuSt) menuSt.textContent = statusText;
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
        const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
        showToast(de ? 'Link kopiert' : 'Link copied');
      } catch {
        const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
        showToast(de ? 'Kopieren nicht möglich' : 'Copy failed');
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

    // topic toggle (pre-vote row)
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
        if (input) { input.value = state.topicLabel || ''; input.focus(); }
      });
    }
    if (cancelBtn && editBox) {
      cancelBtn.addEventListener('click', () => {
        editBox.style.display = 'none';
        $('#topicRow').style.display = state.topicVisible ? '' : 'none';
      });
    }
    if (saveBtn && input) {
      saveBtn.addEventListener('click', () => {
        if (!state.isHost) return;
        const val = input.value || '';
        send('topicSave:' + encodeURIComponent(val));
        editBox.style.display = 'none';
        $('#topicRow').style.display = state.topicVisible ? '' : 'none';
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!state.isHost) return;
        send('topicClear');
        // Keep row visible only if toggle is On (state updates on next tick)
        setTimeout(()=>{ $('#topicRow').style.display = state.topicVisible ? '' : 'none'; }, 50);
      });
    }

    // auto-reveal toggle (pre-vote row)
    const arToggle = $('#autoRevealToggle');
    if (arToggle) {
      arToggle.addEventListener('change', (e) => {
        const on = !!e.target.checked;
        send(`autoReveal:${on}`);
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

    // optional: sequence change coming from menu overlay
    document.addEventListener('ep:sequence-change', (e) => {
      const id = (e && e.detail && e.detail.id) || null;
      if (!id) return;
      if (!state.isHost) return;
      send('sequence:' + encodeURIComponent(id));
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
