/* room.js v32 — WS outbox + robust optimistic state with pending flags:
   - Prevents race where server sends stale voteUpdate right after a user toggle
   - Keeps previous fixes: host-only topic buttons, two-row grid, ∞ handling, topic clear keeps row visible */
(() => {
  'use strict';
  const TAG = '[ROOM]';

  // --- DOM helpers ---
  const $ = (s) => document.querySelector(s);
  const setText = (sel, v) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = v ?? ''; };

  // --- constants ---
  const SPECIALS = ['❓','💬','☕'];
  const INFINITY = '∞';

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
    participants: [],
    averageVote: null,

    sequenceId: null,
    topicVisible: true,
    topicLabel: '',
    topicUrl: null,

    autoRevealEnabled: false,

    // local immediate mirror for my participation (drives disabled buttons instantly)
    meEstimating: true,

    // NEW: pending flags to shield optimistic UI from stale server updates
    _pendingParticipation: null, // true = estimating, false = observer
    _pendingTopicVisible: null,  // true/false
    _pendingAutoReveal: null,    // true/false

    hardRedirect: null
  };

  // --- simple per-room storage (reload UX) ---
  const key = (name) => `ep:${state.roomCode}:${name}`;
  const storage = {
    get(name) { try { return localStorage.getItem(key(name)); } catch { return null; } },
    set(name, val) { try { localStorage.setItem(key(name), String(val)); } catch {} },
    del(name) { try { localStorage.removeItem(key(name)); } catch {} },
  };

  // --- stable per-tab client id ---
  const CIDKEY = 'ep-cid';
  try {
    state.cid = sessionStorage.getItem(CIDKEY);
    if (!state.cid) {
      state.cid = Math.random().toString(36).slice(2) + '-' + Date.now();
      sessionStorage.setItem(CIDKEY, state.cid);
    }
  } catch { state.cid = 'cid-' + Date.now(); }

  // init labels
  setText('#youName', state.youName);
  setText('#roomCodeVal', state.roomCode);

  // --- WS URL ---
  const wsUrl = () => {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return `${proto}${location.host}/gameSocket` +
      `?roomCode=${encodeURIComponent(state.roomCode)}` +
      `&participantName=${encodeURIComponent(state.youName)}` +
      `&cid=${encodeURIComponent(state.cid)}`;
  };

  // --- WS outbox ---
  const pending = []; // array<string>
  function flushPending() {
    if (!state.ws || state.ws.readyState !== 1) return;
    while (pending.length) {
      const line = pending.shift();
      try { state.ws.send(line); } catch (e) { console.warn(TAG, 'send failed (flush)', e); break; }
    }
  }
  function send(line) {
    if (state.ws && state.ws.readyState === 1) {
      try { state.ws.send(line); } catch (e) { console.warn(TAG, 'send failed', e); pending.push(line); }
    } else {
      pending.push(line);
    }
  }

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
      flushPending();
      heartbeat();
    };
    s.onclose = (ev) => {
      state.connected = false;
      console.warn(TAG, 'CLOSE', ev.code, ev.reason || '');
      stopHeartbeat();
      if (state.hardRedirect) { location.href = state.hardRedirect; return; }
      if (ev.code === 4000 || ev.code === 4001) return;
      setTimeout(() => { if (!state.connected) connectWS(); }, 2000);
    };
    s.onerror = (e) => console.warn(TAG, 'ERROR', e);
    s.onmessage = (ev) => {
      try { handleMessage(JSON.parse(ev.data)); }
      catch { console.warn(TAG, 'bad JSON', ev.data); }
    };
  }

  // --- heartbeat ---
  let hbT = null;
  function heartbeat(){ stopHeartbeat(); hbT = setInterval(() => send('ping'), 25000); }
  function stopHeartbeat(){ if (hbT) { clearInterval(hbT); hbT = null; } }

  // --- CSS host badge ---
  function syncHostClass(){ document.body.classList.toggle('is-host', !!state.isHost); }

  // --- messages ---
  function handleMessage(m) {
    switch (m.type) {
      case 'you': {
        if (m.yourName && m.yourName !== state.youName) { state.youName = m.yourName; setText('#youName', state.youName); }
        if (m.cid && m.cid !== state.cid) { state.cid = m.cid; try { sessionStorage.setItem(CIDKEY, state.cid); } catch {} }
        break;
      }
      case 'roomClosed': { state.hardRedirect = m.redirect || '/'; try { state.ws && state.ws.close(4000, 'Room closed'); } catch {} break; }
      case 'kicked':     { state.hardRedirect = m.redirect || '/'; try { state.ws && state.ws.close(4001, 'Kicked'); } catch {} break; }
      case 'voteUpdate': {
        // deck
        const seqId = m.sequenceId || state.sequenceId || 'fib.scrum';
        const specials = (Array.isArray(m.specials) && m.specials.length) ? m.specials.slice() : SPECIALS.slice();
        let base = Array.isArray(m.cards) ? m.cards.slice() : [];
        base = base.filter(c => !specials.includes(c));
        if (seqId !== 'fib.enh') base = base.filter(c => c !== INFINITY);
        state.cards = base.concat(specials);

        state.votesRevealed = !!m.votesRevealed;
        state.averageVote   = m.averageVote ?? null;

        const raw = Array.isArray(m.participants) ? m.participants : [];
        state.participants = raw.map(p => ({ ...p, observer: p.participating === false }));

        // derive server view for me (may be stale)
        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);
        const serverEstimating = !!(me && me.participating !== false);

        // topic fields from server (may be partial / stale)
        const gotTV = Object.prototype.hasOwnProperty.call(m, 'topicVisible');
        const serverTopicVisible = gotTV ? !!m.topicVisible : state.topicVisible;
        if (Object.prototype.hasOwnProperty.call(m, 'topicLabel')) {
          state.topicLabel = m.topicLabel || '';
          storage.set('topicLabel', state.topicLabel);
        }
        if (Object.prototype.hasOwnProperty.call(m, 'topicUrl')) {
          state.topicUrl = m.topicUrl || null;
        }

        const serverAR = !!m.autoRevealEnabled;
        state.sequenceId = m.sequenceId || state.sequenceId;

        // ---- reconcile with pending flags (shield optimistic UI) ----
        // participation
        if (state._pendingParticipation !== null) {
          state.meEstimating = state._pendingParticipation;
          if (serverEstimating === state._pendingParticipation) state._pendingParticipation = null;
        } else {
          state.meEstimating = serverEstimating;
        }

        // topic visible
        if (state._pendingTopicVisible !== null) {
          state.topicVisible = state._pendingTopicVisible;
          if (gotTV && serverTopicVisible === state._pendingTopicVisible) state._pendingTopicVisible = null;
        } else if (gotTV) {
          state.topicVisible = serverTopicVisible;
        }

        // auto reveal
        if (state._pendingAutoReveal !== null) {
          state.autoRevealEnabled = state._pendingAutoReveal;
          if (serverAR === state._pendingAutoReveal) state._pendingAutoReveal = null;
        } else {
          state.autoRevealEnabled = serverAR;
        }

        // persist small bits
        storage.set('ar', state.autoRevealEnabled ? '1' : '0');
        storage.set('topicVisible', state.topicVisible ? '1' : '0');

        syncHostClass();
        renderParticipants();
        renderCards();
        renderResultBar(m);
        renderTopic();
        renderAutoReveal();
        syncMenuFromState();
        syncSequenceInMenu();
        break;
      }
      case 'hostChanged': { break; }
      default: break;
    }
  }

  // --- participants UI ---
  function renderParticipants() {
    const ul = $('#liveParticipantList'); if (!ul) return; ul.innerHTML = '';
    state.participants.forEach(p => {
      const li = document.createElement('li');
      li.className = 'participant-row';
      if (p.disconnected) li.classList.add('disconnected');

      const left = document.createElement('span');
      left.className = 'participant-icon';
      left.textContent = p.isHost ? '👑' : '👤';
      if (p.isHost) left.classList.add('host');
      li.appendChild(left);

      const name = document.createElement('span');
      name.className = 'name'; name.textContent = p.name;
      li.appendChild(name);

      const right = document.createElement('div');
      right.className = 'row-right';

      if (!state.votesRevealed) {
        if (p.observer) {
          const eye = document.createElement('span'); eye.className = 'status-icon observer'; eye.textContent = '👁'; right.appendChild(eye);
        } else if (!p.disconnected && p.vote != null) {
          const done = document.createElement('span'); done.className = 'status-icon done'; done.textContent = '✓'; right.appendChild(done);
        } else if (!p.disconnected) {
          const wait = document.createElement('span'); wait.className = 'status-icon pending'; wait.textContent = '⏳'; right.appendChild(wait);
        }
      } else {
        if (p.observer) {
          const eye = document.createElement('span'); eye.className = 'status-icon observer'; eye.textContent = '👁'; right.appendChild(eye);
        } else {
          const chip = document.createElement('span'); chip.className = 'vote-chip';
          const display = (p.vote == null || p.vote === '') ? '–' : String(p.vote);
          chip.textContent = display;
          const isSpecialChip = (display === '☕' || display === '∞' || p.disconnected || p.participating === false);
          if (isSpecialChip) chip.classList.add('special');
          right.appendChild(chip);
        }
      }

      // host-only actions (HTML present, via CSS .is-host sichtbar)
      if (state.isHost && !p.isHost) {
        const makeHostBtn = document.createElement('button');
        makeHostBtn.className = 'row-action host'; makeHostBtn.type = 'button';
        makeHostBtn.setAttribute('aria-label', 'Make host');
        makeHostBtn.innerHTML = '<span class="ra-icon">👑</span><span class="ra-label">Make host</span>';
        makeHostBtn.addEventListener('click', () => {
          const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
          const q = de ? `Host-Rolle an ${p.name} übergeben?` : `Make ${p.name} the host?`;
          if (confirm(q)) send('makeHost:' + encodeURIComponent(p.name));
        });
        right.appendChild(makeHostBtn);

        const kickBtn = document.createElement('button');
        kickBtn.className = 'row-action kick'; kickBtn.type = 'button';
        kickBtn.setAttribute('aria-label', 'Kick');
        kickBtn.innerHTML = '<span class="ra-icon">❌</span><span class="ra-label">Kick</span>';
        kickBtn.addEventListener('click', () => {
          const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
          const q = de ? `${p.name} wirklich entfernen?` : `Remove ${p.name}?`;
          if (confirm(q)) send('kick:' + encodeURIComponent(p.name));
        });
        right.appendChild(kickBtn);
      }

      li.appendChild(right);
      ul.appendChild(li);
    });
  }

  // --- cards UI ---
  function renderCards() {
    const grid = $('#cardGrid'); if (!grid) return; grid.innerHTML = '';
    const disabled = state.votesRevealed || !state.meEstimating;

    const specials = state.cards.filter(v => SPECIALS.includes(v));
    const numbers  = state.cards.filter(v => !SPECIALS.includes(v));

    numbers.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = String(val);
      if (disabled) btn.disabled = true;
      btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`));
      grid.appendChild(btn);
    });

    if (specials.length) {
      const br = document.createElement('div'); br.className = 'grid-break'; br.setAttribute('aria-hidden', 'true'); grid.appendChild(br);
      specials.forEach(val => {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.textContent = String(val);
        if (disabled) btn.disabled = true;
        btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`));
        grid.appendChild(btn);
      });
    }

    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');
    if (revealBtn) revealBtn.style.display = (!state.votesRevealed && state.isHost) ? '' : 'none';
    if (resetBtn)  resetBtn.style.display  = ( state.votesRevealed && state.isHost) ? '' : 'none';
  }

  function renderResultBar(m) {
    const avgEl = $('#averageVote');
    if (avgEl) avgEl.textContent = (state.averageVote != null ? String(state.averageVote) : 'N/A');

    const pre  = document.querySelector('.pre-vote');
    const post = document.querySelector('.post-vote');
    if (pre && post) { pre.style.display = state.votesRevealed ? 'none' : ''; post.style.display = state.votesRevealed ? '' : 'none'; }

    const medianWrap = $('#medianWrap');
    const rangeWrap  = $('#rangeWrap');
    const rangeSep   = $('#rangeSep');

    if (medianWrap) { const show = m && m.medianVote != null; medianWrap.hidden = !show; if (show) setText('#medianVote', m.medianVote); }
    if (rangeWrap && rangeSep) {
      const show = m && m.range != null; rangeWrap.hidden = !show; rangeSep.hidden = !show; if (show) setText('#rangeVote', m.range);
    }

    const row = $('#resultRow');
    if (row) {
      if (m && m.consensus) {
        row.classList.add('consensus');
        setText('#resultLabel', (document.documentElement.lang === 'de') ? 'Consensus' : 'Consensus');
        const sep1 = document.querySelector('#resultRow .sep'); if (sep1) sep1.hidden = true;
        const mid = $('#medianWrap'); if (mid) mid.hidden = true;
        const rsep = $('#rangeSep'); if (rsep) rsep.hidden = true;
        const rng = $('#rangeWrap'); if (rng) rng.hidden = true;
      } else {
        row.classList.remove('consensus');
        setText('#resultLabel', (document.documentElement.lang === 'de') ? 'Avg:' : 'Avg:');
      }
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

    const shouldShow = !!state.topicVisible;
    if (row) row.style.display = shouldShow ? '' : 'none';
    if (edit && !shouldShow) edit.style.display = 'none';
  }

  // --- auto-reveal UI ---
  function renderAutoReveal() {
    const preSt  = document.querySelector('.pre-vote #arStatus');
    const menuSt = document.querySelector('#appMenuOverlay #menuArStatus');
    const statusText = state.autoRevealEnabled ? 'On' : 'Off';
    if (preSt)  preSt.textContent = statusText;
    if (menuSt) menuSt.textContent = statusText;
  }

  // --- keep overlay/menu in sync ---
  function syncMenuFromState() {
    const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');

    const mTgl = $('#menuTopicToggle');
    const mSt  = $('#menuTopicStatus');
    if (mTgl) { mTgl.checked = !!state.topicVisible; mTgl.setAttribute('aria-checked', String(!!state.topicVisible)); }
    if (mSt) mSt.textContent = state.topicVisible ? (isDe ? 'An' : 'On') : (isDe ? 'Aus' : 'Off');

    const mPTgl = $('#menuParticipationToggle');
    const mPSt  = $('#menuPartStatus');
    if (mPTgl) { mPTgl.checked = !!state.meEstimating; mPTgl.setAttribute('aria-checked', String(!!state.meEstimating)); }
    if (mPSt) mPSt.textContent = state.meEstimating ? (isDe ? 'Ich schätze mit' : "I'm estimating")
                                                    : (isDe ? 'Beobachter:in' : 'Observer');

    const mARTgl = $('#menuAutoRevealToggle');
    if (mARTgl) { mARTgl.checked = !!state.autoRevealEnabled; mARTgl.setAttribute('aria-checked', String(!!state.autoRevealEnabled)); }
  }

  // --- radios (sequence) sync ---
  function syncSequenceInMenu() {
    const root = $('#menuSeqChoice'); if (!root) return;
    root.querySelectorAll('input[type="radio"][name="menu-seq"]').forEach(r => {
      r.disabled = !state.isHost;
      if (r.disabled) r.closest('label')?.classList.add('disabled'); else r.closest('label')?.classList.remove('disabled');
    });

    const id = state.sequenceId || '';
    const sel = root.querySelector(`input[type="radio"][name="menu-seq"][value="${CSS.escape(id)}"]`)
             || root.querySelector(`input[type="radio"][name="menu-seq"][value="${CSS.escape(id.replace('.', '-'))}"]`);
    if (sel) { sel.checked = true; sel.setAttribute('aria-checked','true'); }
  }

  // --- actions for HTML buttons ---
  function revealCards() { send('revealCards'); }
  function resetRoom()   { send('resetRoom'); }
  window.revealCards = revealCards; window.resetRoom = resetRoom;

  // --- optimistic helpers ---
  function optimisticSetMyParticipation(estimating) {
    state._pendingParticipation = !!estimating;
    state.meEstimating = !!estimating;
    const me = state.participants.find(p => p.name === state.youName);
    if (me) { me.participating = !!estimating; me.observer = !estimating; }
    else {
      state.participants.push({ name: state.youName, isHost: state.isHost, participating: !!estimating, observer: !estimating, vote: null, disconnected: false });
    }
    renderCards(); renderParticipants(); syncMenuFromState();
  }

  // --- wiring once ---
  function wireOnce() {
    const copyBtn = $('#copyRoomLink');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      try {
        const link = `${location.origin}/invite?roomCode=${encodeURIComponent(state.roomCode)}`;
        await navigator.clipboard.writeText(link);
        const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
        copyBtn.setAttribute('data-tooltip', de ? 'Link kopiert' : 'Link copied');
      } catch {
        const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
        copyBtn.setAttribute('data-tooltip', de ? 'Kopieren nicht möglich' : 'Copy failed');
      }
    });

    // Legacy checkbox on page (if present)
    const partToggle = $('#participationToggle');
    if (partToggle) {
      partToggle.addEventListener('change', (e) => {
        const estimating = !!e.target.checked;
        optimisticSetMyParticipation(estimating);
        send(`participation:${estimating}`);
      });
    }

    // Topic edit/save/clear
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
        // optimistic UI + persist
        state._pendingTopicVisible = true;
        state.topicVisible = true;
        state.topicLabel = val; state.topicUrl = null;
        storage.set('topicLabel', state.topicLabel); storage.set('topicVisible', '1');
        renderTopic(); syncMenuFromState();
        // tell server
        send('topicSave:' + encodeURIComponent(val));
        send('topicVisible:true');
        editBox.style.display = 'none'; $('#topicRow').style.display = '';
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!state.isHost) return;
        // optimistic clear + persist (keep row visible)
        state._pendingTopicVisible = true;
        state.topicVisible = true;
        state.topicLabel = ''; state.topicUrl = null;
        storage.set('topicLabel', ''); storage.set('topicVisible', '1');
        renderTopic(); syncMenuFromState();
        // tell server
        send('topicSave:' + encodeURIComponent(''));
        send('topicVisible:true');
      });
    }

    // Page-level toggles (if present)
    const arToggle = $('#autoRevealToggle');
    if (arToggle) {
      arToggle.addEventListener('change', (e) => {
        const on = !!e.target.checked;
        state._pendingAutoReveal = on;
        state.autoRevealEnabled = on; storage.set('ar', on ? '1' : '0');
        renderAutoReveal(); syncMenuFromState();
        send(`autoReveal:${on}`);
      });
    }

    // Menu integration (CustomEvents from menu.js)
    document.addEventListener('ep:close-room', () => {
      if (!state.isHost) return;
      const de  = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
      const msg = de ? 'Diesen Raum für alle schließen?' : 'Close this room for everyone?';
      if (confirm(msg)) send('closeRoom');
    });

    document.addEventListener('ep:sequence-change', (ev) => {
      const id = ev?.detail?.id; if (!id || !state.isHost) return;
      send('sequence:' + encodeURIComponent(id));
    });

    document.addEventListener('ep:auto-reveal-toggle', (ev) => {
      const on = !!(ev && ev.detail && ev.detail.on);
      state._pendingAutoReveal = on;
      state.autoRevealEnabled = on; storage.set('ar', on ? '1' : '0');
      renderAutoReveal(); syncMenuFromState();
      send(`autoReveal:${on}`);
    });

    document.addEventListener('ep:topic-toggle', (ev) => {
      const on = !!(ev && ev.detail && ev.detail.on);
      state._pendingTopicVisible = on;
      state.topicVisible = on; storage.set('topicVisible', on ? '1' : '0');
      renderTopic(); syncMenuFromState();
      send(`topicVisible:${on}`);
    });

    document.addEventListener('ep:participation-toggle', (ev) => {
      const estimating = !!(ev && ev.detail && ev.detail.estimating);
      optimisticSetMyParticipation(estimating);
      send(`participation:${estimating}`);
    });

    window.addEventListener('beforeunload', () => { try { send('intentionalLeave'); } catch {} });
  }

  // --- utils ---
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  // --- preseed from storage for fast first paint ---
  function preseedFromStorage() {
    const ar = storage.get('ar'); if (ar === '1' || ar === '0') state.autoRevealEnabled = (ar === '1');
    const tv = storage.get('topicVisible'); if (tv === '1' || tv === '0') state.topicVisible = (tv === '1');
    const tl = storage.get('topicLabel'); if (typeof tl === 'string') state.topicLabel = tl;
    renderTopic(); renderAutoReveal(); syncMenuFromState();
  }

  // --- boot ---
  function boot(){ preseedFromStorage(); wireOnce(); syncHostClass(); connectWS(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
