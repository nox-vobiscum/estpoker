/* room.js v20 — WS connector, participants, host controls, deck layout */
(() => {
  'use strict';
  const TAG = '[ROOM]';

  // --- DOM helpers ---
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
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
    suppressReconnect: false,

    isHost: false,
    votesRevealed: false,
    cards: [],
    participants: [],
    averageVote: null,
    medianVote: null,
    range: null,
    consensus: false,
    outliers: [],

    // Topic from server
    topicVisible: true,
    topicLabel: '',
    topicUrl: null,

    // Auto-reveal from server
    autoRevealEnabled: false,

    // Sequence
    sequenceId: 'fib.scrum',
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
      if (state.suppressReconnect || ev.code === 4000 || ev.code === 4001) return; // no reconnect on controlled close
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

  // --- heartbeat (CID-based) ---
  let hbT = null;
  function heartbeat() { stopHeartbeat(); hbT = setInterval(() => send('ping'), 25000); }
  function stopHeartbeat(){ if (hbT) { clearInterval(hbT); hbT = null; } }

  // --- messages ---
  function handleMessage(m) {
    switch (m.type) {
      case 'you': {
        if (m.yourName && m.yourName !== state.youName) { state.youName = m.yourName; setText('#youName', state.youName); }
        if (m.cid && m.cid !== state.cid) { state.cid = m.cid; try { sessionStorage.setItem(CIDKEY, state.cid); } catch {} }
        break;
      }
      case 'hostChanged': { toast( (isDe() ? 'Host gewechselt zu ' : 'Host changed to ') + (m.newHost || '—') ); break; }
      case 'kicked':     { state.suppressReconnect = true; location.replace(m.redirect || '/'); break; }
      case 'roomClosed': { state.suppressReconnect = true; location.replace(m.redirect || '/'); break; }
      case 'voteUpdate': {
        state.cards         = Array.isArray(m.cards) ? m.cards : state.cards;
        state.votesRevealed = !!m.votesRevealed;
        state.averageVote   = m.averageVote ?? null;
        state.medianVote    = m.medianVote ?? null;
        state.range         = m.range ?? null;
        state.consensus     = !!m.consensus;
        state.outliers      = Array.isArray(m.outliers) ? m.outliers : [];

        const raw = Array.isArray(m.participants) ? m.participants : [];
        state.participants = raw.map(p => ({ ...p, observer: p.participating === false }));

        state.topicVisible      = !!m.topicVisible;
        state.topicLabel        = m.topicLabel || '';
        state.topicUrl          = m.topicUrl || null;
        state.autoRevealEnabled = !!m.autoRevealEnabled;
        state.sequenceId        = m.sequenceId || state.sequenceId;

        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);

        renderParticipants();
        renderCards();
        renderResultBar();
        renderTopic();
        renderAutoReveal();
        syncMenuFromState();
        break;
      }
      default: break;
    }
  }

  // --- participants UI ---
  function renderParticipants() {
    const ul = $('#liveParticipantList'); if (!ul) return;
    ul.innerHTML = '';

    const me = state.participants.find(p => p.name === state.youName);

    state.participants.forEach(p => {
      const li = document.createElement('li');
      li.className = 'participant-row';
      if (p.disconnected) li.classList.add('disconnected');
      if (p.isHost) li.classList.add('is-host');

      // Left icon: host crown or silhouette
      const left = document.createElement('span');
      left.className = 'participant-icon';
      left.textContent = p.isHost ? '👑' : '👤';
      if (p.isHost) left.classList.add('host');
      li.appendChild(left);

      // Name
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      li.appendChild(name);

      // Right: status + actions
      const right = document.createElement('div');
      right.className = 'row-right';

      // Status
      const status = document.createElement('span');
      status.className = 'status-icon';

      if (!state.votesRevealed) {
        if (p.observer) { status.textContent = '👁'; status.classList.add('observer'); }
        else if (!p.disconnected && p.vote != null) { status.textContent = '✅'; status.classList.add('done'); }
        else { status.textContent = '⏳'; status.classList.add('pending'); }
        right.appendChild(status);
      } else {
        if (p.observer) {
          status.textContent = '👁'; status.classList.add('observer');
          right.appendChild(status);
        } else {
          const chip = document.createElement('span');
          chip.className = 'vote-chip';
          let display = (p.vote == null || p.vote === '') ? '–' : String(p.vote);
          chip.textContent = display;
          if (display === '☕' || display === '❓' || display === '💬') chip.classList.add('special'); // ∞ stays normal
          if (Array.isArray(state.outliers) && state.outliers.includes(p.name)) chip.classList.add('outlier');
          right.appendChild(chip);
        }
      }

      // Host-only actions for others
      if (state.isHost && !p.isHost && p.name !== (me && me.name)) {
        const makeHost = document.createElement('button');
        makeHost.type = 'button';
        makeHost.className = 'row-action host';
        makeHost.title = isDe() ? 'Zum Host machen' : 'Make host';
        makeHost.innerHTML = '<span class="ra-icon">👑</span><span class="ra-label">Host</span>';
        makeHost.addEventListener('click', () => {
          const msg = isDe() ? `Host-Rolle an ${p.name} übergeben?` : `Make ${p.name} the host?`;
          if (confirm(msg)) send('makeHost:' + encodeURIComponent(p.name));
        });
        right.appendChild(makeHost);

        const kick = document.createElement('button');
        kick.type = 'button';
        kick.className = 'row-action kick';
        kick.title = isDe() ? 'Teilnehmer entfernen' : 'Kick participant';
        kick.innerHTML = '<span class="ra-icon">❌</span><span class="ra-label">Kick</span>';
        kick.addEventListener('click', () => {
          const msg = isDe() ? `Teilnehmer ${p.name} entfernen?` : `Remove ${p.name}?`;
          if (confirm(msg)) send('kick:' + encodeURIComponent(p.name));
        });
        right.appendChild(kick);
      }

      li.appendChild(right);
      ul.appendChild(li);
    });
  }

  // --- cards UI ---
  function renderCards() {
    const gridWrap = $('#cardGrid'); if (!gridWrap) return;

    // IMPORTANT: older markup gives #cardGrid the "card-grid" class (outer grid).
    // Remove it so our two-row layout (numbers grid + specials grid) works correctly.
    gridWrap.classList.remove('card-grid', 'fixed4');

    gridWrap.innerHTML = '';

    const me = state.participants.find(pp => pp.name === state.youName);
    const isObserver = !!(me && me.observer);
    const disabled = state.votesRevealed || isObserver;

    // Split values into primary (numbers + "∞") and specials (❓ 💬 ☕)
    const specialsSet = new Set(['❓','💬','☕']);
    const all = Array.isArray(state.cards) ? state.cards.map(v => String(v)) : [];
    const primary = [];
    const specials = new Set(['❓','💬','☕']); // always present

    for (const v of all) {
      if (specialsSet.has(v)) specials.add(v);
      else primary.push(v); // includes "∞" -> like a number
    }

    // Primary row
    const grid1 = document.createElement('div');
    grid1.className = 'card-grid';
    primary.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(val);
      if (disabled) btn.disabled = true;
      btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`));
      grid1.appendChild(btn);
    });
    gridWrap.appendChild(grid1);

    // Specials row in fixed order
    const order = ['❓','💬','☕'];
    const grid2 = document.createElement('div');
    grid2.className = 'card-grid fixed4';
    order.forEach(val => {
      if (!specials.has(val)) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = val;
      if (disabled) btn.disabled = true;
      btn.addEventListener('click', () => send(`vote:${state.youName}:${val}`));
      grid2.appendChild(btn);
    });
    gridWrap.appendChild(grid2);

    // Reveal / Reset visibility
    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');
    if (revealBtn) revealBtn.style.display = (!state.votesRevealed && state.isHost) ? '' : 'none';
    if (resetBtn)  resetBtn.style.display  = ( state.votesRevealed && state.isHost) ? '' : 'none';

    // Participation label near toggle
    const partStatus = $('#partStatus');
    if (partStatus && me) {
      partStatus.textContent = !isObserver
        ? (isDe() ? 'Ich schätze mit' : "I'm estimating")
        : (isDe() ? 'Beobachter:in' : 'Observer');
    }
  }

  function renderResultBar() {
    const avgEl = $('#averageVote');
    const medWrap = $('#medianWrap');
    const rangeWrap = $('#rangeWrap');
    const rangeSep = $('#rangeSep');

    const pre  = document.querySelector('.pre-vote');
    const post = document.querySelector('.post-vote');
    if (pre && post) {
      pre.style.display  = state.votesRevealed ? 'none' : '';
      post.style.display = state.votesRevealed ? '' : 'none';
    }

    const row = $('#resultRow');
    if (!row) return;

    // Consensus-only display
    if (state.votesRevealed && state.consensus && state.averageVote) {
      row.classList.add('consensus');
      setText('#resultLabel', isDe() ? 'Consensus' : 'Consensus');
      setText(avgEl, String(state.averageVote)); // no trailing dot
      if (medWrap)   medWrap.hidden = true;
      if (rangeWrap) rangeWrap.hidden = true;
      if (rangeSep)  rangeSep.hidden = true;
    } else {
      row.classList.toggle('consensus', false);
      setText('#resultLabel', isDe() ? 'Avg:' : 'Avg:');
      if (avgEl) avgEl.textContent = (state.votesRevealed && state.averageVote != null) ? String(state.averageVote) : '–';

      if (medWrap) {
        const showMed = state.votesRevealed && !!state.medianVote && !state.consensus;
        medWrap.hidden = !showMed;
        setText('#medianVote', showMed ? String(state.medianVote) : '–');
      }
      if (rangeWrap) {
        const showRange = state.votesRevealed && !!state.range && !state.consensus;
        rangeWrap.hidden = !showRange;
        if (rangeSep) rangeSep.hidden = !showRange;
        setText('#rangeVote', showRange ? String(state.range) : '–');
      }
    }
  }

  // --- topic UI ---
  function renderTopic() {
    const row = $('#topicRow');
    const edit = $('#topicEdit');
    const disp = $('#topicDisplay');
    const toggle = $('#topicToggle');
    const status = $('#topicStatus');

    if (toggle) { toggle.checked = !!state.topicVisible; toggle.setAttribute('aria-checked', String(!!state.topicVisible)); }
    if (status) status.textContent = state.topicVisible ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');

    const shouldShow = !!state.topicVisible;
    if (row) row.style.display = shouldShow ? '' : 'none';

    if (disp) {
      if (state.topicLabel && state.topicUrl) {
        disp.innerHTML = `<a href="${encodeURI(state.topicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.topicLabel)}</a>`;
      } else if (state.topicLabel) {
        disp.textContent = state.topicLabel;
      } else {
        disp.textContent = '—';
      }
    }
    if (edit && !shouldShow) edit.style.display = 'none';
  }

  // --- auto-reveal UI ---
  function renderAutoReveal() {
    const tgl = $('#autoRevealToggle');
    if (tgl) { tgl.checked = !!state.autoRevealEnabled; tgl.setAttribute('aria-checked', String(!!state.autoRevealEnabled)); }
    const preSt  = document.querySelector('.pre-vote #arStatus');
    const menuSt = document.querySelector('#appMenuOverlay #menuArStatus');
    const statusText = state.autoRevealEnabled ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');
    if (preSt)  preSt.textContent = statusText;
    if (menuSt) menuSt.textContent = statusText;
  }

  // --- keep overlay/menu in sync ---
  function syncMenuFromState() {
    // Topic
    const mTgl = $('#menuTopicToggle');
    const mSt  = $('#menuTopicStatus');
    if (mTgl) { mTgl.checked = !!state.topicVisible; mTgl.setAttribute('aria-checked', String(!!state.topicVisible)); }
    if (mSt) mSt.textContent = state.topicVisible ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');

    // Participation
    const me = state.participants.find(p => p.name === state.youName);
    const isObserver = !!(me && me.observer);
    const mPTgl = $('#menuParticipationToggle');
    const mPSt  = $('#menuPartStatus');
    if (mPTgl) { mPTgl.checked = !isObserver; mPTgl.setAttribute('aria-checked', String(!isObserver)); }
    if (mPSt)  mPSt.textContent = !isObserver ? (isDe() ? 'Ich schätze mit' : "I'm estimating")
                                              : (isDe() ? 'Beobachter:in' : 'Observer');

    // Auto-reveal
    const mARTgl = $('#menuAutoRevealToggle');
    if (mARTgl) { mARTgl.checked = !!state.autoRevealEnabled; mARTgl.setAttribute('aria-checked', String(!!state.autoRevealEnabled)); }

    // Sequence radios
    const seqId = state.sequenceId;
    $$('#menuSeqChoice input[type="radio"][name="menu-seq"]').forEach(r => {
      r.checked = (r.value === seqId);
      r.closest('.radio-row')?.classList.toggle('disabled', !state.isHost);
      r.disabled = !state.isHost;
    });

    // Host-only toggles/hints
    const isHost = state.isHost;
    ['menuAutoRevealToggle','menuTopicToggle'].forEach(id => {
      const el = $('#'+id);
      el && (el.disabled = !isHost);
      const row = el?.closest('.menu-item') || el?.closest('.menu-group');
      row && row.classList.toggle('disabled', !isHost);
    });
    $('#menuSeqHint')?.classList.toggle('hidden', isHost);
    $('#menuArHint')?.classList.toggle('hidden', isHost);
    $('#menuTopicToggleHint')?.classList.toggle('hidden', isHost);
  }

  // --- actions for HTML buttons ---
  function revealCards() { send('revealCards'); }
  function resetRoom()   { send('resetRoom'); }
  window.revealCards = revealCards;
  window.resetRoom   = resetRoom;

  // --- wiring ---
  function wireOnce() {
    // Copy link to /invite
    const copyBtn = $('#copyRoomLink');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      const link = `${location.origin}/invite?roomCode=${encodeURIComponent(state.roomCode)}`;
      try { await navigator.clipboard.writeText(link); toast(isDe() ? 'Link in die Zwischenablage kopiert' : 'Link copied to clipboard'); copyBtn.setAttribute('data-tooltip', isDe() ? 'Link kopiert' : 'Link copied'); }
      catch { copyBtn.setAttribute('data-tooltip', isDe() ? 'Kopieren nicht möglich' : 'Copy failed'); }
    });

    // participation switch
    $('#participationToggle')?.addEventListener('change', (e) => {
      const estimating = !!e.target.checked; send(`participation:${estimating}`);
    });

    // topic toggle
    $('#topicToggle')?.addEventListener('change', (e) => {
      const on = !!e.target.checked; send(`topicToggle:${on}`);
    });

    // topic edit/save/clear
    const editBtn = $('#topicEditBtn');
    const clearBtn = $('#topicClearBtn');
    const editBox = $('#topicEdit');
    const row = $('#topicRow');
    const input = $('#topicInput');
    const saveBtn = $('#topicSaveBtn');
    const cancelBtn = $('#topicCancelBtn');

    editBtn && editBtn.addEventListener('click', () => {
      if (!state.isHost) return;
      editBox.style.display = '';
      row.style.display = 'none';
      if (input) { input.value = state.topicLabel || ''; input.focus(); }
    });
    cancelBtn && cancelBtn.addEventListener('click', () => {
      editBox.style.display = 'none';
      row.style.display = state.topicVisible ? '' : 'none';
    });
    saveBtn && saveBtn.addEventListener('click', () => {
      if (!state.isHost) return;
      const val = input.value || '';
      send('topicSave:' + encodeURIComponent(val));
      editBox.style.display = 'none';
      row.style.display = state.topicVisible ? '' : 'none';
    });
    clearBtn && clearBtn.addEventListener('click', () => {
      if (!state.isHost) return;
      send('topicClear');
    });

    // auto-reveal toggle
    $('#autoRevealToggle')?.addEventListener('change', (e) => {
      const on = !!e.target.checked; send(`autoReveal:${on}`);
    });

    // Overlay → sequence
    document.addEventListener('ep:sequence-change', (ev) => {
      const id = ev?.detail?.id; if (!id || !state.isHost) return;
      send('sequence:' + encodeURIComponent(id));
    });

    // menu: close room
    document.addEventListener('ep:close-room', () => {
      if (!state.isHost) return;
      const msg = isDe() ? 'Diesen Raum für alle schließen?' : 'Close this room for everyone?';
      if (confirm(msg)) send('closeRoom');
    });

    // best-effort leave
    window.addEventListener('pagehide', () => { try { send('intentionalLeave'); } catch {} }, { capture: true });
    window.addEventListener('beforeunload', () => { try { send('intentionalLeave'); } catch {} });
  }

  // --- utils ---
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function isDe(){ return (document.documentElement.lang||'en').toLowerCase().startsWith('de'); }
  function toast(text){ try{ const el=document.createElement('div'); el.className='toast'; el.textContent=String(text||''); document.body.appendChild(el); setTimeout(()=>el.remove(),3000);}catch{} }

  // --- boot ---
  function boot(){ wireOnce(); connectWS(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
