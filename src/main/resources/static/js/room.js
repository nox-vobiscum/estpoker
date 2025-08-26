/* room.js v18 — robust connector for /gameSocket (CID-based, topic, host-safe) */
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
    sequenceId: null,
    participants: [],
    averageVote: null,
    medianVote: null,
    range: null,
    consensus: false,
    outliers: new Set(),

    // Topic from GameService
    topicVisible: true,
    topicLabel: '',
    topicUrl: null,

    // Auto-reveal from GameService
    autoRevealEnabled: false,

    // reconnection guard
    hardRedirected: false
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
      stopHeartbeat();
      state.connected = false;
      console.warn(TAG, 'CLOSE', ev.code, ev.reason || '');

      // do not reconnect after server-close signals
      if (state.hardRedirected) return;
      if (ev && (ev.code === 4000 || ev.code === 4001)) return;

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
    // Send more frequent pings to keep "active"; server has long grace period
    hbT = setInterval(() => send('ping'), 15000);
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
        state.cards          = Array.isArray(m.cards) ? m.cards : state.cards;
        state.sequenceId     = m.sequenceId || state.sequenceId;
        state.votesRevealed  = !!m.votesRevealed;
        state.averageVote    = m.averageVote ?? null;
        state.medianVote     = m.medianVote ?? null;
        state.range          = m.range ?? null;
        state.consensus      = !!m.consensus;
        state.outliers       = new Set(Array.isArray(m.outliers) ? m.outliers : []);

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
        syncMenuFromState();  // keep overlay labels/toggles in sync

        break;
      }
      case 'hostChanged': {
        // No special UI; full state snapshot will follow shortly
        break;
      }
      case 'roomClosed': {
        state.hardRedirected = true;
        const to = m.redirect || '/';
        location.replace(to);
        break;
      }
      case 'kicked': {
        state.hardRedirected = true;
        const to = m.redirect || '/';
        location.replace(to);
        break;
      }
      default: break;
    }
  }

  // --- participants UI ---
  function isSpecialValue(v) {
    return v === '☕' || v === '?' || v === '💬' || v === '∞';
  }

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
      else { left.textContent = '👤'; } // default person silhouette
      li.appendChild(left);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      li.appendChild(name);

      const right = document.createElement('div');
      right.className = 'row-right';

      if (!state.votesRevealed) {
        if (p.observer) {
          const eye = document.createElement('span'); // observer eye pre-reveal (right side)
          eye.className = 'status-icon observer';
          eye.textContent = '👁';
          right.appendChild(eye);
        } else if (!p.disconnected && p.vote == null) {
          const wait = document.createElement('span');
          wait.className = 'status-icon pending';
          wait.textContent = '⏳';
          right.appendChild(wait);
        } else if (!p.disconnected && p.vote != null) {
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

        // Grey chip for observers/disconnected/specials
        if (p.observer || p.disconnected || isSpecialValue(display)) {
          chip.classList.add('special');
        }
        // Outlier highlight ring if provided
        if (!isSpecialValue(display) && state.outliers.has(p.name)) {
          chip.classList.add('outlier');
        }
        right.appendChild(chip);
      }

      // Host-only actions on each non-self participant
      if (state.isHost && !p.isHost) {
        const makeHost = document.createElement('button');
        makeHost.type = 'button';
        makeHost.className = 'row-action host';
        makeHost.innerHTML = `<span class="ra-icon">👑</span><span class="ra-label">Make host</span>`;
        makeHost.addEventListener('click', () => {
          const confirmMsg = (document.documentElement.lang || 'en').startsWith('de')
            ? `Host-Rolle an ${p.name} übergeben?`
            : `Make ${p.name} the host?`;
          if (confirm(confirmMsg)) send('makeHost:' + encodeURIComponent(p.name));
        });

        const kick = document.createElement('button');
        kick.type = 'button';
        kick.className = 'row-action kick';
        kick.innerHTML = `<span class="ra-icon">❌</span><span class="ra-label">Kick</span>`;
        kick.addEventListener('click', () => {
          const confirmMsg = (document.documentElement.lang || 'en').startsWith('de')
            ? `Teilnehmer:in „${p.name}“ wirklich entfernen?`
            : `Really remove “${p.name}”?`;
          if (confirm(confirmMsg)) send('kick:' + encodeURIComponent(p.name));
        });

        right.appendChild(makeHost);
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

    // Split into numeric vs specials; special handling for ∞ in fib.enh
    const specialsBase = ['?', '💬', '☕'];
    const numbers = [];
    const specials = [];

    (state.cards || []).forEach(val => {
      const v = String(val);
      if (v === '∞') {
        if (state.sequenceId === 'fib.enh') numbers.push(v);   // render like a number in fib.enh
        else specials.push(v);
        return;
      }
      if (specialsBase.includes(v)) specials.push(v);
      else numbers.push(v);
    });

    // Ensure the three standard specials always present (client-side patch)
    specialsBase.forEach(sv => { if (!specials.includes(sv)) specials.push(sv); });

    const me = state.participants.find(pp => pp.name === state.youName);
    const isObserver = !!(me && me.observer);
    const disabled = state.votesRevealed || isObserver;

    // helper to create a card button
    const addBtn = (value, container) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(value);
      if (disabled) btn.disabled = true;
      btn.addEventListener('click', () => send(`vote:${state.youName}:${value}`));
      container.appendChild(btn);
    };

    // First row: numbers
    numbers.forEach(v => addBtn(v, grid));

    // Second row: specials
    const specialsRow = document.createElement('div');
    specialsRow.className = 'specials-row';
    specials.forEach(v => addBtn(v, specialsRow));
    grid.appendChild(specialsRow);

    // Reveal/reset buttons visibility (host only)
    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');
    if (revealBtn) revealBtn.style.display = (!state.votesRevealed && state.isHost) ? '' : 'none';
    if (resetBtn)  resetBtn.style.display  = ( state.votesRevealed && state.isHost) ? '' : 'none';
  }

  function renderResultBar() {
    const pre  = document.querySelector('.pre-vote');
    const post = document.querySelector('.post-vote');
    if (pre && post) {
      pre.style.display  = state.votesRevealed ? 'none' : '';
      post.style.display = state.votesRevealed ? '' : 'none';
    }

    const label = $('#resultLabel');
    const avgEl = $('#averageVote');
    const medWrap = $('#medianWrap');
    const rangeWrap = $('#rangeWrap');
    const rangeSep = $('#rangeSep');
    if (!avgEl || !label) return;

    if (state.votesRevealed) {
      if (state.consensus) {
        label.textContent = 'Consensus 🎉';
        avgEl.textContent = state.averageVote ?? '–';
        medWrap && (medWrap.hidden = true);
        rangeWrap && (rangeWrap.hidden = true);
        rangeSep && (rangeSep.hidden = true);
        const row = $('#resultRow');
        row && row.classList.add('consensus');
      } else {
        label.textContent = (document.documentElement.lang || 'en').startsWith('de') ? 'Avg:' : 'Avg:';
        avgEl.textContent = state.averageVote ?? '–';
        // median & range visible only if present
        if (medWrap) {
          const medVal = $('#medianVote');
          medWrap.hidden = !(state.medianVote);
          if (medVal) medVal.textContent = state.medianVote ?? '–';
        }
        if (rangeWrap) {
          const rVal = $('#rangeVote');
          rangeWrap.hidden = !(state.range);
          if (rVal) rVal.textContent = state.range ?? '–';
        }
        rangeSep && (rangeSep.hidden = !(state.range));
        const row = $('#resultRow');
        row && row.classList.remove('consensus');
      }
    } else {
      avgEl.textContent = '–';
      medWrap && (medWrap.hidden = true);
      rangeWrap && (rangeWrap.hidden = true);
      rangeSep && (rangeSep.hidden = true);
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

    const shouldShow = !!state.topicVisible || state.isHost; // keep row visible for host even empty
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

    // Sequence radios (overlay)
    const mSeq = $('#menuSeqChoice');
    if (mSeq && state.sequenceId) {
      const all = mSeq.querySelectorAll('input[type="radio"][name="menu-seq"]');
      all.forEach(r => {
        r.checked = (r.value === state.sequenceId);
        r.closest('.radio-row')?.classList.toggle('disabled', !state.isHost);
        r.disabled = !state.isHost;
      });
    }

    // Host-only hints
    $('#menuSeqHint') && ($('#menuSeqHint').style.display = state.isHost ? 'none' : '');
    $('#menuArHint') && ($('#menuArHint').style.display = state.isHost ? 'none' : '');
    $('#menuTopicToggleHint') && ($('#menuTopicToggleHint').style.display = state.isHost ? 'none' : '');
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
        // lightweight toast
        const n = document.createElement('div');
        n.className = 'toast';
        n.textContent = (document.documentElement.lang || 'en').startsWith('de')
          ? 'Link kopiert'
          : 'Link copied';
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
      } catch {
        copyBtn.setAttribute('data-tooltip', (document.documentElement.lang || 'en').startsWith('de') ? 'Kopieren nicht möglich' : 'Copy failed');
      }
    });

    // participation switch (pre-vote row) — hidden in CSS, still functional if shown
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
        // keep row visible for host, but clear content
        send('topicClear');
      });
    }

    // auto-reveal toggle (pre-vote row; server handler enforces host)
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

    // Sequence change bubble from menu.js
    document.addEventListener('ep:sequence-change', (ev) => {
      const id = ev && ev.detail && ev.detail.id;
      if (!id) return;
      if (!state.isHost) return; // host only
      send('sequence:' + id);
    });

    // menu: close room event (from menu.js)
    document.addEventListener('ep:close-room', () => {
      if (!state.isHost) return;
      const de  = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
      const msg = de ? 'Diesen Raum für alle schließen?' : 'Close this room for everyone?';
      if (confirm(msg)) send('closeRoom');
    });

    // mark intentional leave on unload (best effort)
    window.addEventListener('pagehide', () => { send('intentionalLeave'); }, { capture: true });
    window.addEventListener('beforeunload', () => { send('intentionalLeave'); }, { capture: true });
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
