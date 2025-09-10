/* room.js — UI + WS glue for Estimation Poker */
(() => {
  'use strict';

  const TAG = '[ROOM]';
  const $ = (s) => document.querySelector(s);
  const setText = (sel, v) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (el) el.textContent = v ?? '';
  };

  // ---------------- Constants ----------------
  const SPECIALS = ['❓', '💬', '☕'];
  const INFINITY_ = '♾️';
  const INFINITY_ALT = '∞'; // backward-compat

  const IDLE_MS_THRESHOLD = 900_000; // 15min

  // script dataset / URL params
  const scriptEl = document.querySelector('script[src*="/js/room.js"]');
  const ds = (scriptEl && scriptEl.dataset) || {};
  const url = new URL(location.href);

  // ---------------- State (client) ----------------
  const state = {
    roomCode: ds.room || url.searchParams.get('roomCode') || 'demo',
    youName: ds.participant || url.searchParams.get('participantName') || 'Guest',
    cid: null,
    ws: null,
    connected: false,

    isHost: false,
    _hostKnown: false,
    votesRevealed: false,
    cards: [],
    participants: [],
    averageVote: null,
    medianVote: null,
    range: null,
    consensus: false,
    outliers: [],

    sequenceId: null,
    topicVisible: true,
    topicLabel: '',
    topicUrl: null,

    autoRevealEnabled: false,

    // client-only toggles
    hardMode: false,
    allowSpecials: true,

    // topic edit
    topicEditing: false,

    // UI helpers
    _optimisticVote: null,
    hardRedirect: null
  };

  // stable per-tab client id
  const CIDKEY = 'ep-cid';
  try {
    state.cid = sessionStorage.getItem(CIDKEY);
    if (!state.cid) {
      state.cid = Math.random().toString(36).slice(2) + '-' + Date.now();
      sessionStorage.setItem(CIDKEY, state.cid);
    }
  } catch {
    state.cid = 'cid-' + Date.now();
  }

  setText('#youName', state.youName);
  setText('#roomCodeVal', state.roomCode);

  // canonicalize URL params without reload
  (function canonicalizeRoomUrl() {
    try {
      const desiredQs = new URLSearchParams({
        roomCode: state.roomCode || '',
        participantName: state.youName || ''
      }).toString();
      const current = location.search.replace(/^\?/, '');
      if (current !== desiredQs) {
        const newUrl = `${location.pathname}?${desiredQs}${location.hash || ''}`;
        history.replaceState(null, '', newUrl);
      }
    } catch {}
  })();

  // ---------------- Helpers ----------------
  function normalizeSeq(id) {
    if (!id) return 'fib.scrum';
    const s = String(id).toLowerCase().trim();
    if (s === 'fib-enh') return 'fib.enh';
    if (s === 'fib-math') return 'fib.math';
    if (s === 't-shirt') return 'tshirt';
    return s;
  }

  function isDe() {
    return (document.documentElement.lang || 'en').toLowerCase().startsWith('de');
  }

  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return `${proto}${location.host}/gameSocket` +
      `?roomCode=${encodeURIComponent(state.roomCode)}` +
      `&participantName=${encodeURIComponent(state.youName)}` +
      `&cid=${encodeURIComponent(state.cid)}`;
  }

  function syncHostClass() {
    document.body.classList.toggle('is-host', !!state.isHost);
  }

  // ---------------- WebSocket ----------------
  function connectWS() {
    const u = wsUrl();
    console.info(TAG, 'connect →', u);
    let s;
    try { s = new WebSocket(u); } catch (e) { console.error(TAG, e); return; }
    state.ws = s;

    s.onopen = () => {
      state.connected = true;
      try { send('rename:' + encodeURIComponent(state.youName)); } catch {}
      heartbeat();
    };
    s.onclose = (ev) => {
      state.connected = false; stopHeartbeat();
      if (state.hardRedirect) { location.href = state.hardRedirect; return; }
      if (ev.code === 4000 || ev.code === 4001) return;
      setTimeout(() => { if (!state.connected) connectWS(); }, 2000);
    };
    s.onerror = (e) => console.warn(TAG, 'ERROR', e);
    s.onmessage = (ev) => { try { handleMessage(JSON.parse(ev.data)); } catch (e) { console.warn('Bad message', e); } };
  }
  function send(line) { if (state.ws && state.ws.readyState === 1) state.ws.send(line); }

  // heartbeat
  let hbT = null;
  function heartbeat() { stopHeartbeat(); hbT = setInterval(() => send('ping'), 25_000); }
  function stopHeartbeat() { if (hbT) { clearInterval(hbT); hbT = null; } }

  // ---------------- Messages ----------------
  function handleMessage(m) {
    switch (m.type) {
      case 'you': {
        if (m.yourName && m.yourName !== state.youName) { state.youName = m.yourName; setText('#youName', state.youName); }
        if (m.cid && m.cid !== state.cid) { state.cid = m.cid; try { sessionStorage.setItem(CIDKEY, state.cid); } catch {} }
        break;
      }
      case 'roomClosed': {
        state.hardRedirect = m.redirect || '/';
        try { state.ws && state.ws.close(4000, 'Room closed'); } catch {}
        break;
      }
      case 'kicked': {
        state.hardRedirect = m.redirect || '/';
        try { state.ws && state.ws.close(4001, 'Kicked'); } catch {}
        break;
      }
      case 'participantLeft': {
        const name = m.name || '';
        const msg = isDe() ? `${name} hat den Raum verlassen` : `${name} left the room`;
        showToast(msg);
        break;
      }
      case 'participantRenamed': {
        const from = m.from || '', to = m.to || '';
        const msg = isDe() ? `${from} heißt jetzt ${to}` : `${from} is now ${to}`;
        showToast(msg);
        break;
      }
      case 'hostTransferred': {
        const from = m.from || '', to = m.to || '';
        const msg = (state.youName === to)
          ? (isDe() ? 'Host gewechselt. Du bist jetzt Host!' : 'Host changed. You are now host!')
          : (isDe() ? `Host-Rolle wurde an ${to} übertragen` : `Host role transferred to ${to}`);
        showToast(msg);
        break;
      }
      case 'voteUpdate': {
        applyVoteUpdate(m);
        break;
      }
      default: break;
    }
  }

  function applyVoteUpdate(m) {
  const seqId = normalizeSeq(m.sequenceId || state.sequenceId || 'fib.scrum');
  const specials = (Array.isArray(m.specials) && m.specials.length) ? m.specials.slice() : SPECIALS.slice();

  let base = Array.isArray(m.cards) ? m.cards.slice() : [];
  base = base.filter(c => !specials.includes(c));
  if (seqId !== 'fib.enh') base = base.filter(c => c !== INFINITY_ && c !== INFINITY_ALT);
  state.cards = base.concat(specials);

  state.votesRevealed = !!m.votesRevealed;
  state.averageVote   = (m.hasOwnProperty('averageVote') ? m.averageVote : null);
  state.medianVote    = (m.hasOwnProperty('medianVote') ? m.medianVote  : null);
  state.range         = (m.hasOwnProperty('range')      ? m.range       : null);
  state.consensus     = !!m.consensus;
  state.outliers      = Array.isArray(m.outliers) ? m.outliers : [];

  const raw = Array.isArray(m.participants) ? m.participants : [];
  state.participants = raw.map(p => ({
    name:           p?.name ?? '',
    vote:           (p?.vote ?? null),
    disconnected:   !!p?.disconnected,
    away:           !!p?.away,
    isHost:         !!p?.isHost,
    participating:  (p?.participating !== false),
    observer:       (p?.participating === false)
  }));

  state.sequenceId = seqId;
  state.autoRevealEnabled = !!m.autoRevealEnabled;

  if (m.hasOwnProperty('topicVisible')) state.topicVisible = !!m.topicVisible;
  if (m.hasOwnProperty('topicLabel'))   state.topicLabel   = m.topicLabel || '';
  if (m.hasOwnProperty('topicUrl'))     state.topicUrl     = m.topicUrl || null;

  const me = state.participants.find(p => p && p.name === state.youName);
  state.isHost = !!(me && me.isHost);
  state._hostKnown = true;
  if (me && me.vote != null) state._optimisticVote = null;

  syncHostClass();
  renderParticipants();
  renderCards();
  renderResultBar();
  renderTopic();
  renderAutoReveal();
  requestAnimationFrame(() => { syncMenuFromState(); syncSequenceInMenu(); });

  if (!document.documentElement.hasAttribute('data-ready')) {
    document.documentElement.setAttribute('data-ready', '1');
  }
}



  // ---------------- Participants ----------------
  function isIdle(p) {
    if (!p || p.disconnected) return false;
    if (typeof p.idleMs === 'number') return p.idleMs >= IDLE_MS_THRESHOLD;
    if (p.away === true) return true;
    return false;
  }

  function renderParticipants() {
  const ul = $('#liveParticipantList'); if (!ul) return;
  try {
    const frag = document.createDocumentFragment();
    (state.participants || []).forEach(p => {
      if (!p || !p.name) return;

      const li = document.createElement('li');
      li.className = 'participant-row';
      if (p.disconnected) li.classList.add('disconnected');
      if (p.isHost)       li.classList.add('is-host');

      const left = document.createElement('span');
      left.className = 'participant-icon' + (p.isHost ? ' host' : '');
      left.textContent = p.isHost ? '👑' : '👤';
      left.setAttribute('aria-hidden', 'true');
      li.appendChild(left);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      li.appendChild(name);

      const right = document.createElement('div');
      right.className = 'row-right';

      if (!state.votesRevealed) {
        if (p.observer) {
          const eye = document.createElement('span');
          eye.className = 'status-icon observer';
          eye.textContent = '👁️';
          right.appendChild(eye);
        } else if (!p.disconnected && p.vote != null && String(p.vote) !== '') {
          const done = document.createElement('span');
          done.className = 'status-icon done';
          done.textContent = '✓';
          right.appendChild(done);
        } else if (!p.disconnected) {
          const dash = document.createElement('span');
          dash.className = 'vote-chip empty';
          dash.textContent = '–';
          right.appendChild(dash);
        }
      } else {
        if (p.observer) {
          const eye = document.createElement('span');
          eye.className = 'status-icon observer';
          eye.textContent = '👁️';
          right.appendChild(eye);
        } else {
          const chip = document.createElement('span');
          chip.className = 'vote-chip';
          const display = (p.vote == null || p.vote === '') ? '–' : String(p.vote);
          chip.textContent = display;

          const isInfinity = (display === INFINITY_ || display === INFINITY_ALT);
          const isSpecial  = SPECIALS.includes(display);
          if (!isInfinity && isSpecial) chip.classList.add('special');

          if (Array.isArray(state.outliers) && state.outliers.includes(p.name)) {
            chip.classList.add('outlier');
          }
          right.appendChild(chip);
        }
      }

      if (state.isHost && !p.isHost) {
        const makeHostBtn = document.createElement('button');
        makeHostBtn.className = 'row-action host';
        makeHostBtn.type = 'button';
        makeHostBtn.setAttribute('aria-label', isDe() ? 'Zum Host machen' : 'Make host');
        makeHostBtn.innerHTML = '<span class="ra-icon">👑</span>';
        makeHostBtn.addEventListener('click', () => {
          const q = isDe() ? `Host-Rolle an ${p.name} übertragen?` : `Transfer host role to ${p.name}?`;
          if (confirm(q)) send('makeHost:' + encodeURIComponent(p.name));
        });
        right.appendChild(makeHostBtn);

        const kickBtn = document.createElement('button');
        kickBtn.className = 'row-action kick';
        kickBtn.type = 'button';
        kickBtn.setAttribute('aria-label', isDe() ? 'Teilnehmer entfernen' : 'Kick participant');
        kickBtn.innerHTML = '<span class="ra-icon">❌</span>';
        kickBtn.addEventListener('click', () => {
          const q = isDe() ? `${p.name} wirklich entfernen?` : `Remove ${p.name}?`;
          if (confirm(q)) send('kick:' + encodeURIComponent(p.name));
        });
        right.appendChild(kickBtn);
      }

      li.appendChild(right);
      frag.appendChild(li);
    });
    ul.replaceChildren(frag);
  } catch (e) {
    console.error(TAG, 'renderParticipants failed', e);
  }
}



  // ---------------- Cards ----------------
  function mySelectedValue() {
    const me = state.participants.find(pp => pp.name === state.youName);
    if (me && me.vote != null && me.vote !== '') return String(me.vote);
    if (state._optimisticVote != null) return String(state._optimisticVote);
    return null;
  }

  function isSpecialOrEmpty(s) {
  if (s == null) return true;
  const t = String(s).trim();
  if (t === '' || t === INFINITY_ || t === INFINITY_ALT || SPECIALS.includes(t)) return true;
  return isNaN(Number(t));
}

  function allEligibleVoted() {
    const elig = state.participants.filter(p => p && !p.observer && !p.disconnected);
    if (!elig.length) return false;
    return elig.every(p => p.vote != null && String(p.vote) !== '');
  }

  function renderCards() {
    const grid = $('#cardGrid'); if (!grid) return;
    grid.innerHTML = '';

    const me = state.participants.find(pp => pp.name === state.youName);
    const isObserver = !!(me && me.observer);
    const disabled = state.votesRevealed || isObserver;

    const specialsAll = state.cards.filter(v => SPECIALS.includes(v));
    const numbers = state.cards.filter(v => !SPECIALS.includes(v));
    const specials = state.allowSpecials ? specialsAll : [];

    const selectedVal = mySelectedValue();

    function addCardButton(val) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const label = String(val);
      btn.textContent = label;

      if (label === INFINITY_ || label === INFINITY_ALT) btn.classList.add('card-infinity');
      
      if (disabled) btn.disabled = true;
      if (selectedVal != null && String(selectedVal) === label) btn.classList.add('selected');

      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        state._optimisticVote = label;
        grid.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        send(`vote:${state.youName}:${label}`);
      });

      grid.appendChild(btn);
    }

    numbers.forEach(addCardButton);
    if (specials.length) {
      const br = document.createElement('div'); br.className = 'grid-break'; br.setAttribute('aria-hidden', 'true'); grid.appendChild(br);
      specials.forEach(addCardButton);
    }

    const revealBtn = $('#revealButton');
    const resetBtn = $('#resetButton');

    const hardGateOK = !state.hardMode || allEligibleVoted();

    const showReveal = (!state.votesRevealed && state.isHost);
    const showReset = (state.votesRevealed && state.isHost);

    if (revealBtn) {
      revealBtn.style.display = showReveal ? '' : 'none';
      revealBtn.hidden = !showReveal;
      revealBtn.disabled = !hardGateOK;
      if (!hardGateOK) {
        revealBtn.setAttribute('title', isDe() ? 'Es haben noch nicht alle ihre Schätzung abgegeben' : 'Not everyone has voted yet');
        revealBtn.setAttribute('aria-disabled', 'true');
      } else {
        revealBtn.removeAttribute('title');
        revealBtn.removeAttribute('aria-disabled');
      }
    }
    if (resetBtn) {
      resetBtn.style.display = showReset ? '' : 'none';
      resetBtn.hidden = !showReset;
    }
  }

  // ---------------- Result bar ----------------
function renderResultBar() {
  // add "+♾️" suffix after reveal if any participant (non-observer) picked infinity
  const hasInfinity = !!(
    state.votesRevealed &&
    Array.isArray(state.participants) &&
    state.participants.some(
      (p) => p && !p.observer && (p.vote === INFINITY_ || p.vote === INFINITY_ALT)
    )
  );
  const inf = hasInfinity ? ' +♾️' : '';

  // average
  const avgEl = $('#averageVote');
  if (avgEl) {
    avgEl.textContent = (state.averageVote != null) ? String(state.averageVote) + inf : 'N/A';
  }

  // pre/post blocks toggle
  const pre  = document.querySelector('.pre-vote');
  const post = document.querySelector('.post-vote');
  if (pre && post) {
    pre.style.display  = state.votesRevealed ? 'none' : '';
    post.style.display = state.votesRevealed ? '' : 'none';
  }

  const row        = $('#resultRow');
  const avgWrap    = document.querySelector('#resultLabel .label-average');
  const consEl     = document.querySelector('#resultLabel .label-consensus');
  const medianWrap = $('#medianWrap');
  const rangeWrap  = $('#rangeWrap');
  const rangeSep   = $('#rangeSep');

  if (row) {
    if (state.consensus) {
      row.classList.add('consensus');
      if (avgWrap) avgWrap.hidden = true;
      if (consEl) {
        consEl.hidden = false;
        consEl.textContent = isDe() ? '🎉 Konsens' : '🎉 Consensus';
      }
      const sep1 = document.querySelector('#resultRow .sep');
      if (sep1) sep1.hidden = true;
      if (medianWrap) medianWrap.hidden = true;
      if (rangeSep)  rangeSep.hidden  = true;
      if (rangeWrap) rangeWrap.hidden = true;
    } else {
      row.classList.remove('consensus');
      if (avgWrap) avgWrap.hidden = false;
      if (consEl)  consEl.hidden  = true;
    }
  }

  if (!state.consensus) {
    if (medianWrap) {
      const show = state.medianVote != null;
      medianWrap.hidden = !show;
      if (show) setText('#medianVote', String(state.medianVote) + inf);
    }
    if (rangeWrap && rangeSep) {
      const show = state.range != null;
      rangeWrap.hidden = !show;
      rangeSep.hidden  = !show;
      if (show) setText('#rangeVote', String(state.range) + inf);
    }
  }
}


  // ---------------- Topic row ----------------
  function renderTopic() {
  const row = $('#topicRow');
  if (!row) return;

  // ensure we always have a display <span id="topicDisplay">
  let disp = $('#topicDisplay');
  if (!disp || disp.tagName !== 'SPAN') {
    const span = document.createElement('span');
    span.id = 'topicDisplay';
    span.className = 'topic-text';
    if (disp) disp.replaceWith(span); else row.insertBefore(span, row.firstChild ? row.firstChild.nextSibling : null);
    disp = span;
  }

  // visibility
  row.style.display = state.topicVisible ? '' : 'none';

  // content (when not editing)
  if (!state.topicEditing) {
    if (state.topicLabel && state.topicUrl) {
      disp.innerHTML = `<a href="${encodeURI(state.topicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.topicLabel)}</a>`;
    } else if (state.topicLabel) {
      disp.textContent = state.topicLabel;
    } else {
      disp.textContent = '–';
    }
  }

  // actions (host-only)
  const actions = row.querySelector('.topic-actions') || (() => {
    const a = document.createElement('div');
    a.className = 'topic-actions';
    row.appendChild(a);
    return a;
  })();

  if (!state.isHost) { actions.innerHTML = ''; return; }

  if (!state.topicEditing) {
    actions.innerHTML =
      `<button id="topicEditBtn" class="row-action host-only" type="button" title="${isDe() ? 'Bearbeiten' : 'Edit'}" aria-label="${isDe() ? 'Bearbeiten' : 'Edit'}"><span class="ra-icon">✍️</span></button>
       <button id="topicClearBtn" class="row-action kick host-only" type="button" title="${isDe() ? 'Feld leeren' : 'Clear'}" aria-label="${isDe() ? 'Feld leeren' : 'Clear'}"><span class="ra-icon">🗑️</span></button>`;

    const editBtn = $('#topicEditBtn');
    const clearBtn = $('#topicClearBtn');

    if (editBtn) editBtn.addEventListener('click', beginTopicEdit);
    if (clearBtn) clearBtn.addEventListener('click', () => {
      send('topicSave:' + encodeURIComponent(''));
      state.topicLabel = '';
      state.topicUrl = null;
      state.topicEditing = false;
      renderTopic();
    });
  } else {
    // swap display <span> -> <input>
    let inp = row.querySelector('input.topic-inline-input');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'topic-inline-input';
      inp.placeholder = isDe()
        ? 'JIRA-Link einfügen oder Key eingeben'
        : 'Paste JIRA link or type key';
      disp.replaceWith(inp);
      inp.id = 'topicDisplay';
    }
    inp.value = state.topicLabel || '';
    setTimeout(() => { try { inp.focus(); inp.select(); } catch {} }, 0);

    actions.innerHTML =
      `<button id="topicSaveBtn" class="row-action host-only" type="button" title="${isDe() ? 'Speichern' : 'Save'}" aria-label="${isDe() ? 'Speichern' : 'Save'}"><span class="ra-icon">✅</span></button>
       <button id="topicCancelEditBtn" class="row-action host-only" type="button" title="${isDe() ? 'Abbrechen' : 'Cancel'}" aria-label="${isDe() ? 'Abbrechen' : 'Cancel'}"><span class="ra-icon">❌</span></button>`;

    const saveBtn = $('#topicSaveBtn');
    const cancelBtn = $('#topicCancelEditBtn');

    const doSave = () => {
      const val = inp.value || '';
      send('topicSave:' + encodeURIComponent(val));
      state.topicEditing = false;
      renderTopic();
    };
    const doCancel = () => {
      state.topicEditing = false;
      renderTopic();
    };

    if (saveBtn)  saveBtn.addEventListener('click', doSave);
    if (cancelBtn) cancelBtn.addEventListener('click', doCancel);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doSave(); }
      if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
    });
  }
}

function beginTopicEdit() {
  if (!state.isHost) return;
  state.topicEditing = true;
  renderTopic();
}


  // ---------------- Auto-reveal badge ----------------
  function renderAutoReveal() {
    const preSt = document.querySelector('.pre-vote #arStatus');
    const menuSt = document.querySelector('#appMenuOverlay #menuArStatus');
    const statusText = state.autoRevealEnabled ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');
    if (preSt) preSt.textContent = statusText;
    if (menuSt) menuSt.textContent = statusText;
  }

  // ---------------- Menu sync ----------------
  function setRowDisabled(inputId, disabled) {
    const input = document.getElementById(inputId);
    const row = input ? input.closest('.menu-item.switch') : null;
    if (input) { input.disabled = !!disabled; input.setAttribute('aria-disabled', String(!!disabled)); }
    if (row) { row.classList.toggle('disabled', !!disabled); }
  }

  function syncMenuFromState() {
    setRowDisabled('menuAutoRevealToggle', !state.isHost && state._hostKnown);
    setRowDisabled('menuTopicToggle', !state.isHost && state._hostKnown);
    setRowDisabled('menuSpecialsToggle', !state.isHost && state._hostKnown);
    setRowDisabled('menuHardModeToggle', !state.isHost && state._hostKnown);

    const mTgl = $('#menuTopicToggle'); const mSt = $('#menuTopicStatus');
    if (mTgl) { mTgl.checked = !!state.topicVisible; mTgl.setAttribute('aria-checked', String(!!state.topicVisible)); }
    if (mSt) mSt.textContent = state.topicVisible ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');

    const me = state.participants.find(p => p.name === state.youName);
    const isObserver = !!(me && me.observer);
    const mPTgl = $('#menuParticipationToggle'); const mPSt = $('#menuPartStatus');
    if (mPTgl) { mPTgl.checked = !isObserver; mPTgl.setAttribute('aria-checked', String(!isObserver)); }
    if (mPSt) mPSt.textContent = !isObserver ? (isDe() ? 'Ich schätze mit' : "I'm estimating") : (isDe() ? 'Beobachter:in' : 'Observer');

    const mARTgl = $('#menuAutoRevealToggle');
    if (mARTgl) { mARTgl.checked = !!state.autoRevealEnabled; mARTgl.setAttribute('aria-checked', String(!!state.autoRevealEnabled)); }

    const mSPTgl = $('#menuSpecialsToggle'); const mSPSt = $('#menuSpecialsStatus');
    if (mSPTgl) { mSPTgl.checked = !!state.allowSpecials; mSPTgl.setAttribute('aria-checked', String(!!state.allowSpecials)); }
    if (mSPSt) mSPSt.textContent = state.allowSpecials ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');

    const mHRTgl = $('#menuHardModeToggle'); const mHRSt = $('#menuHardStatus');
    if (mHRTgl) { mHRTgl.checked = !!state.hardMode; mHRTgl.setAttribute('aria-checked', String(!!state.hardMode)); }
    if (mHRSt) mHRSt.textContent = state.hardMode ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');
  }

  function syncSequenceInMenu() {
  const root = $('#menuSeqChoice'); if (!root) return;

  root.querySelectorAll('input[type="radio"][name="menu-seq"]').forEach(r => {
    const shouldDisable = state._hostKnown ? !state.isHost : false;
    r.disabled = !!shouldDisable;
    r.setAttribute('aria-disabled', String(!!shouldDisable));
    const lab = r.closest('label');
    if (lab) lab.classList.toggle('disabled', !!shouldDisable);
  });

  const esc = (s) => (window.CSS && typeof CSS.escape === 'function') ? CSS.escape(s) : String(s).replace(/"/g, '\\"');

  const id = state.sequenceId || '';
  const sel =
    root.querySelector(`input[type="radio"][name="menu-seq"][value="${esc(id)}"]`) ||
    root.querySelector(`input[type="radio"][name="menu-seq"][value="${esc(id.replace('.', '-'))}"]`);
  if (sel) { sel.checked = true; sel.setAttribute('aria-checked', 'true'); }
}


  document.addEventListener('ep:menu-open', () => { syncMenuFromState(); syncSequenceInMenu(); });

  // ---------------- Global actions ----------------
  function revealCards() {
    if (state.hardMode && !allEligibleVoted()) {
      showToast(isDe() ? 'Erst aufdecken, wenn alle gewählt haben.' : 'Reveal only after everyone voted.');
      return;
    }
    send('revealCards');
  }
  function resetRoom() { send('resetRoom'); }
  window.revealCards = revealCards;
  window.resetRoom = resetRoom;

  // ---------------- Toast & copy helpers ----------------
  function showToast(msg, ms = 2600) {
    try {
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = msg;
      document.body.appendChild(t);
      // force reflow for CSS animation
      // eslint-disable-next-line no-unused-expressions
      t.offsetHeight;
      setTimeout(() => t.remove(), ms + 600);
    } catch {}
  }

  function inviteUrl() {
    return `${location.origin}/invite?roomCode=${encodeURIComponent(state.roomCode)}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch { return false; }
    }
  }

  function bindCopyLink() {
    const candidates = [
      '#copyRoomLink',
      '#copyRoomLinkBtn',
      '#copyRoomBtn',
      '.room-with-actions .icon-button',
      '.main-info .icon-button'
    ].map(sel => $(sel)).filter(Boolean);
    const btn = candidates[0];
    if (!btn) return;

    const okMsg = isDe() ? 'Link kopiert' : 'Link copied';
    const failMsg = isDe() ? 'Kopieren fehlgeschlagen' : 'Copy failed';

    async function handle() {
      const ok = await copyText(inviteUrl());
      const prev = btn.getAttribute('title');
      btn.setAttribute('title', ok ? okMsg : failMsg);
      showToast(ok ? okMsg : failMsg);
      if (prev != null) setTimeout(() => btn.setAttribute('title', prev), 2200);
      else setTimeout(() => btn.removeAttribute('title'), 2200);
    }
    btn.addEventListener('click', (e) => { e.preventDefault(); handle(); });
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(); } });
  }

  // ---------------- Menu events ----------------
  function wireMenuEvents() {
    document.addEventListener('ep:close-room', () => {
      if (!state.isHost) return;
      const msg = isDe() ? 'Diesen Raum für alle schließen?' : 'Close this room for everyone?';
      if (confirm(msg)) send('closeRoom');
    });

    document.addEventListener('ep:sequence-change', (ev) => {
      const id = normalizeSeq(ev?.detail?.id); if (!id) return;
      if (!state.isHost) return;
      send('sequence:' + encodeURIComponent(id));
    });

    document.addEventListener('ep:auto-reveal-toggle', (ev) => {
      if (!state.isHost) return;
      const on = !!(ev && ev.detail && ev.detail.on);
      send(`autoReveal:${on}`);
    });

    document.addEventListener('ep:topic-toggle', (ev) => {
      if (!state.isHost) return;
      const on = !!(ev && ev.detail && ev.detail.on);
      if (!on) state.topicEditing = false;
      send(`topicVisible:${on}`);
      renderTopic();
    });

    document.addEventListener('ep:participation-toggle', (ev) => {
      const estimating = !!(ev && ev.detail && ev.detail.estimating);
      send(`participation:${estimating}`);
    });

    // host-only local toggles (client-side only right now)
    document.addEventListener('ep:specials-toggle', (ev) => {
    if (!state.isHost) return;
      const on = !!(ev && ev.detail && ev.detail.on);
    // optimistic local update
      state.allowSpecials = on;
      syncMenuFromState();
      renderCards();
    // inform server (room-wide)
      send(`specials:${on}`);
  });

    document.addEventListener('ep:hard-mode-toggle', (ev) => {
      if (!state.isHost) return;
      const on = !!(ev && ev.detail && ev.detail.on);
      state.hardMode = on;
      syncMenuFromState();
      renderCards();
    });
  }

  // ---------------- Misc helpers ----------------
  // was numeric-looking for chip styling: infinity counts as numeric here
  function isDisplaySpecialChip(s) {
    if (s == null) return true; // treat empty as special-ish (dash)
    const t = String(s).trim();
    // only real specials are styled as "special", infinity is NOT
    return ['❓','💬','☕'].includes(t);
  }


  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

// ---------------- Wire & boot ----------------
function wireOnce() {
  bindCopyLink();
  wireMenuEvents();

  // clicking empty topic row (host only) opens editor
  const row = $('#topicRow');
  if (row) {
    row.addEventListener('click', (e) => {
      if (!state.isHost || state.topicEditing) return;
      if (state.topicLabel) return;
      if (e.target.closest('button,a,input')) return;
      beginTopicEdit();
    });
  }

  // NO 'intentionalLeave' on beforeunload anymore (grace will handle refresh/close)
  window.addEventListener('pageshow', () => {
    document.dispatchEvent(new CustomEvent('ep:request-sync', { detail: { room: state.roomCode } }));
    if (!state.connected && (!state.ws || state.ws.readyState !== 1)) connectWS();
  });

  syncSequenceInMenu();
}

function boot() { wireOnce(); syncHostClass(); connectWS(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
