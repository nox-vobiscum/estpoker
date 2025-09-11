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

  // ----- Presence guard (2s grace; never self-toast) ------------------------
  const PRESENCE_GRACE_MS = 2000;
  const PRESENCE_KEY = (n) => 'ep-presence:' + encodeURIComponent(n);

  // Mark participant as "alive now"
  function markAlive(name) {
    if (!name) return;
    try { localStorage.setItem(PRESENCE_KEY(name), String(Date.now())); } catch {}
  }

  // Should we toast this presence event? kind: 'left' | 'join'
  function shouldToastPresence(name, kind) {
    if (!name) return false;
    if (name === state.youName) return false; // never self-toast

    let last = 0;
    try { last = parseInt(localStorage.getItem(PRESENCE_KEY(name)) || '0', 10) || 0; } catch {}
    const delta = Date.now() - last;
    // For both join/left: only toast if last activity is older than grace
    return delta > PRESENCE_GRACE_MS;
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
      case 'participantJoined': {
        const name = m.name || '';
        if (shouldToastPresence(name, 'join')) {
          showToast(isDe() ? `${name} ist beigetreten` : `${name} joined the room`);
        }
        break;
      }
      case 'participantLeft': {
        const name = m.name || '';
        if (shouldToastPresence(name, 'left')) {
          showToast(isDe() ? `${name} hat den Raum verlassen` : `${name} left the room`);
        }
        break;
      }
      case 'participantRenamed': {
        const from = m.from || '', to = m.to || '';
        if (from !== state.youName) {
          showToast(isDe() ? `${from} heißt jetzt ${to}` : `${from} is now ${to}`);
        }
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
    try {
      // --- sequence id ---
      const seqId = normalizeSeq(m.sequenceId || state.sequenceId || 'fib.scrum');

      // --- specials & deck (robust gegen Server-Varianten) ---
      // Server kann schicken:
      //  (A) m.specials = ["❓","💬","☕"]  -> Specials EIN (explizite Liste)
      //      m.specials = []              -> Specials AUS (explizit leer)
      //  (B) m.allowSpecials = true|false -> Boolean-Schalter
      //  (C) Legacy: m.specialsOff / m.specialsEnabled
      //  (D) nichts -> Client-Status beibehalten
      let specialsList = null;      // wenn null: Deck-Specials unverändert lassen
      let allowFromServer = null;   // wenn null: allowSpecials nicht anfassen

      if (Array.isArray(m.specials)) {
        specialsList = m.specials.slice();
        allowFromServer = specialsList.length > 0;
      }
      if (typeof m.allowSpecials === 'boolean') {
        allowFromServer = m.allowSpecials;
        if (specialsList === null) specialsList = m.allowSpecials ? SPECIALS.slice() : [];
      }
      if (typeof m.specialsOff === 'boolean') {
        allowFromServer = !m.specialsOff;
        if (specialsList === null) specialsList = (!m.specialsOff) ? SPECIALS.slice() : [];
      }
      if (typeof m.specialsEnabled === 'boolean') {
        allowFromServer = m.specialsEnabled;
        if (specialsList === null) specialsList = m.specialsEnabled ? SPECIALS.slice() : [];
      }

      if (typeof allowFromServer === 'boolean') {
        state.allowSpecials = allowFromServer;
      }

      // Basis: Server-Deck, sonst bisheriges Deck
      let deck = Array.isArray(m.cards) ? m.cards.slice() : (Array.isArray(state.cards) ? state.cards.slice() : []);

      // Infinity nur bei fib.enh erlauben
      if (seqId !== 'fib.enh') {
        deck = deck.filter(c => c !== INFINITY_ && c !== INFINITY_ALT);
      }

      // Wenn der Server eine Specials-Liste mitgibt (oder explizit „leer“),
      // dann Deck-Specials exakt daran ausrichten:
      if (specialsList !== null) {
        deck = deck.filter(c => !SPECIALS.includes(c)).concat(specialsList);
      }
      state.cards = deck;

      // --- Core state ---
      state.votesRevealed = !!m.votesRevealed;
      state.averageVote   = (m.hasOwnProperty('averageVote') ? m.averageVote : null);
      state.medianVote    = (m.hasOwnProperty('medianVote')  ? m.medianVote  : null);
      state.range         = (m.hasOwnProperty('range')       ? m.range       : null);
      state.consensus     = !!m.consensus;
      state.outliers      = Array.isArray(m.outliers) ? m.outliers : [];

      // --- Participants ---
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

      // --- Topic / flags ---
      state.sequenceId = seqId;
      state.autoRevealEnabled = !!m.autoRevealEnabled;

      if (m.hasOwnProperty('topicVisible')) state.topicVisible = !!m.topicVisible;
      if (m.hasOwnProperty('topicLabel'))   state.topicLabel   = m.topicLabel || '';
      if (m.hasOwnProperty('topicUrl'))     state.topicUrl     = m.topicUrl || null;

      // who am I
      const me = state.participants.find(p => p && p.name === state.youName);
      state.isHost = !!(me && me.isHost);
      state._hostKnown = true;
      if (me && me.vote != null) state._optimisticVote = null;

      // render
      syncHostClass();
      renderParticipants();
      renderCards();
      renderResultBar();
      renderTopic();
      renderAutoReveal();

      // presence freshness → dämpft irrtümliche leave/join-toasts
      try {
        (state.participants || []).forEach(p => {
          if (p && !p.disconnected) markAlive(p.name);
        });
      } catch {}

      requestAnimationFrame(() => { syncMenuFromState(); syncSequenceInMenu(); });

      if (!document.documentElement.hasAttribute('data-ready')) {
        document.documentElement.setAttribute('data-ready', '1');
      }
    } catch (e) {
      console.error(TAG, 'applyVoteUpdate failed', e);
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

        const isInactive = !!p.disconnected || !!p.away;
        if (isInactive) li.classList.add('disconnected');
        if (p.isHost)    li.classList.add('is-host');

        // Left icon (role/presence)
        const left = document.createElement('span');
        left.className = 'participant-icon' + (p.isHost ? ' host' : '');
        let icon = '👤';
        if (p.isHost)                 icon = '👑';
        else if (p.observer === true) icon = '👁️';
        else if (isInactive)          icon = '💤';
        left.textContent = icon;
        left.setAttribute('aria-hidden', 'true');
        if (isInactive) left.classList.add('inactive');  // slightly dim
        li.appendChild(left);

        // Name
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = p.name;
        li.appendChild(name);

        // Right column (chips + actions)
        const right = document.createElement('div');
        right.className = 'row-right';

        // --- CHIP COLUMN ----------------------------------------------------
        if (!state.votesRevealed) {
          // Pre-vote: always render a *mini-chip* so the column width is stable
          if (p.observer) {
            const eye = document.createElement('span');
            eye.className = 'mini-chip observer';
            eye.textContent = '👁️';
            right.appendChild(eye);
          } else if (!p.disconnected && p.vote != null && String(p.vote) !== '') {
            const ok = document.createElement('span');
            ok.className = 'mini-chip done';
            ok.textContent = '✓';
            right.appendChild(ok);
          } else {
            const dash = document.createElement('span');
            dash.className = isInactive ? 'mini-chip' : 'mini-chip pending';
            dash.textContent = isInactive ? '–' : '⏳';
            right.appendChild(dash);
          }
        } else {
          // Post-vote
          if (p.observer) {
            const eye = document.createElement('span');
            eye.className = 'mini-chip observer';
            eye.textContent = '👁️';
            right.appendChild(eye);
          } else {
            if (isInactive) {
              const dash = document.createElement('span');
              dash.className = 'mini-chip';
              dash.textContent = '–';
              right.appendChild(dash);
            } else {
              const chip = document.createElement('span');
              const noVote  = (p.vote == null || p.vote === '');
              const display = noVote ? '–' : String(p.vote);

              if (noVote) {
                chip.className = 'mini-chip';
                chip.textContent = '–';
                right.appendChild(chip);
              } else {
                chip.className = 'vote-chip';
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
          }
        }

        // --- ROW ACTIONS (far right) ---------------------------------------
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
      console.error('[ROOM] renderParticipants failed', e);
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

    // Split deck into numeric vs. specials
    const deckSpecialsFromState = (state.cards || []).filter(v => SPECIALS.includes(v));
    const deckNumbers           = (state.cards || []).filter(v => !SPECIALS.includes(v));

    // Robust fallback: if the deck doesn't carry specials, use default SPECIALS
    // (and dedupe against numbers just in case).
    const specialsCandidate = deckSpecialsFromState.length ? deckSpecialsFromState : SPECIALS.slice();
    const specialsDedupe = [...new Set(specialsCandidate.filter(s => !deckNumbers.includes(s)))];

    // Honor host toggle
    const specials = state.allowSpecials ? specialsDedupe : [];

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

    // Render numeric cards
    deckNumbers.forEach(addCardButton);

    // Break line before specials (only if any)
    if (specials.length) {
      const br = document.createElement('div');
      br.className = 'grid-break';
      br.setAttribute('aria-hidden', 'true');
      grid.appendChild(br);
      specials.forEach(addCardButton);
    }

    // CTA buttons logic
    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');
    const hardGateOK = !state.hardMode || allEligibleVoted();

    const showReveal = (!state.votesRevealed && state.isHost);
    const showReset  = (state.votesRevealed && state.isHost);

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
    // Was any non-observer vote == infinity?
    const hasInfinity = !!(
      state.votesRevealed &&
      Array.isArray(state.participants) &&
      state.participants.some(p => p && !p.observer && (p.vote === INFINITY_ || p.vote === INFINITY_ALT))
    );

    // helpers
    const t = (v) => (v == null || v === '' ? null : String(v));
    const withInf = (base) => (base != null ? base + (hasInfinity ? ' +♾️' : '') : (hasInfinity ? '♾️' : null));

    // toggle pre/post blocks
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
    const avgEl      = $('#averageVote');

    // Average text
    if (avgEl) {
      const avgTxt = withInf(t(state.averageVote));
      avgEl.textContent = avgTxt ?? (state.votesRevealed ? 'N/A' : '');
    }

    // Consensus mode collapses to one label
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
        return;
      } else {
        row.classList.remove('consensus');
        if (avgWrap) avgWrap.hidden = false;
        if (consEl)  consEl.hidden  = true;
      }
    }

    // Median & Range (only when revealed and value exists)
    if (medianWrap) {
      const showM = state.votesRevealed && t(state.medianVote) != null;
      medianWrap.hidden = !showM;
      if (showM) setText('#medianVote', withInf(t(state.medianVote)));
    }
    if (rangeWrap && rangeSep) {
      const showR = state.votesRevealed && t(state.range) != null;
      rangeWrap.hidden = !showR;
      rangeSep.hidden  = !showR;
      if (showR) setText('#rangeVote', withInf(t(state.range)));
    }
  }

 // ---------------- Topic row (ellipsis in text + separate “more” button) ----------------
function renderTopic() {
  const row = $('#topicRow'); if (!row) return;

  // Show/hide the whole row based on room state
  row.style.display = state.topicVisible ? '' : 'none';

  // Ensure actions container exists (right side)
  let actions = row.querySelector('.topic-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'topic-actions';
    row.appendChild(actions);
  }

  // Ensure #topicDisplay exists (SPAN in view mode, INPUT in edit mode)
  let displayEl = row.querySelector('#topicDisplay');

  // Helper: render label/url into the display element (view mode only)
  const renderDisplayContent = (el) => {
    if (state.topicLabel && state.topicUrl) {
      el.innerHTML = `<a href="${encodeURI(state.topicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.topicLabel)}</a>`;
    } else if (state.topicLabel) {
      el.textContent = state.topicLabel;
    } else {
      el.textContent = '–';
    }
    // Keep a tooltip with the full content on the link (if present) or the span
    const full = [state.topicLabel || '', state.topicUrl || ''].filter(Boolean).join(' — ');
    const link = el.querySelector && el.querySelector('a');
    (link || el).setAttribute('title', full || '');
  };

  // Create (or reuse) the compact "more" button that sits to the right of the text
  let hint = row.querySelector('#topicOverflowHint');
  const ensureHint = () => {
    if (!hint) {
      const btn = document.createElement('button');
      btn.id = 'topicOverflowHint';
      btn.type = 'button';
      btn.className = 'topic-more-btn';             // styled as subtle text-button in CSS
      btn.textContent = 'more';                     // label per request (always English)
      btn.setAttribute('aria-label', 'Show full topic');
      hint = btn;
    }
  };

  // Non-hosts: view-only (SPAN + optional "more", no action buttons)
  if (!state.isHost) {
    if (!displayEl || displayEl.tagName !== 'SPAN') {
      const span = document.createElement('span');
      span.id = 'topicDisplay';
      span.className = 'topic-text';               // CSS does the single-line + ellipsis
      if (displayEl) displayEl.replaceWith(span);
      else row.insertBefore(span, row.firstChild ? row.firstChild.nextSibling : null);
      displayEl = span;
    }
    renderDisplayContent(displayEl);

    ensureHint();
    if (!hint.isConnected) row.insertBefore(hint, actions); // place between text and actions
    // No actions for non-hosts
    actions.innerHTML = '';

    requestAnimationFrame(syncTopicOverflow);
    return;
  }

  // Host: switch between VIEW and EDIT modes
  if (!state.topicEditing) {
    // VIEW MODE (host)
    if (!displayEl || displayEl.tagName !== 'SPAN') {
      const span = document.createElement('span');
      span.id = 'topicDisplay';
      span.className = 'topic-text';
      if (displayEl) displayEl.replaceWith(span);
      else row.insertBefore(span, row.firstChild ? row.firstChild.nextSibling : null);
      displayEl = span;
    }
    renderDisplayContent(displayEl);

    ensureHint();
    if (!hint.isConnected) row.insertBefore(hint, actions);

    // Host actions (use icon-button, not row-action)
    actions.innerHTML =
      `<button id="topicEditBtn"
               class="icon-button neutral"
               type="button"
               title="${isDe() ? 'Bearbeiten' : 'Edit'}"
               aria-label="${isDe() ? 'Bearbeiten' : 'Edit'}">✍️</button>
       <button id="topicClearBtn"
               class="icon-button neutral"
               type="button"
               title="${isDe() ? 'Feld leeren' : 'Clear'}"
               aria-label="${isDe() ? 'Feld leeren' : 'Clear'}">🗑️</button>`;

    const editBtn  = $('#topicEditBtn');
    const clearBtn = $('#topicClearBtn');
    if (editBtn)  editBtn.addEventListener('click', beginTopicEdit);
    if (clearBtn) clearBtn.addEventListener('click', () => {
      send('topicSave:' + encodeURIComponent(''));
      state.topicLabel = '';
      state.topicUrl = null;
      state.topicEditing = false;
      renderTopic();
    });

    requestAnimationFrame(syncTopicOverflow);
  } else {
    // EDIT MODE (host)
    if (!displayEl || displayEl.tagName !== 'INPUT') {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'topic-inline-input';
      inp.id = 'topicDisplay';
      inp.placeholder = isDe()
        ? 'JIRA-Link einfügen oder Key eingeben'
        : 'Paste JIRA link or type key';
      if (displayEl) displayEl.replaceWith(inp);
      else row.insertBefore(inp, row.firstChild ? row.firstChild.nextSibling : null);
      displayEl = inp;
    }
    displayEl.value = state.topicLabel || '';
    setTimeout(() => { try { displayEl.focus(); displayEl.select(); } catch {} }, 0);

    // Hide the "more" button while editing
    if (hint) hint.style.display = 'none';

    actions.innerHTML =
      `<button id="topicSaveBtn"
               class="icon-button neutral"
               type="button"
               title="${isDe() ? 'Speichern' : 'Save'}"
               aria-label="${isDe() ? 'Speichern' : 'Save'}">✅</button>
       <button id="topicCancelEditBtn"
               class="icon-button neutral"
               type="button"
               title="${isDe() ? 'Abbrechen' : 'Cancel'}"
               aria-label="${isDe() ? 'Abbrechen' : 'Cancel'}">❌</button>`;

    const saveBtn   = $('#topicSaveBtn');
    const cancelBtn = $('#topicCancelEditBtn');

    const doSave = () => {
      const val = displayEl.value || '';
      send('topicSave:' + encodeURIComponent(val));
      state.topicEditing = false;
      renderTopic();
    };
    const doCancel = () => {
      state.topicEditing = false;
      renderTopic();
    };

    if (saveBtn)   saveBtn.addEventListener('click', doSave);
    if (cancelBtn) cancelBtn.addEventListener('click', doCancel);
    displayEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); doSave(); }
      if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
    });
  }
}

// Toggle edit mode (host only)
function beginTopicEdit() {
  if (!state.isHost) return;
  state.topicEditing = true;
  renderTopic();
}

// Check if text overflows the single-line box; if yes, show the "more" button
function syncTopicOverflow() {
  try {
    const row  = $('#topicRow'); if (!row) return;
    const el   = row.querySelector('#topicDisplay');
    const hint = row.querySelector('#topicOverflowHint');
    if (!el || !hint) return;

    // Only in view mode (SPAN). Input has its own UX.
    const inViewMode = el && el.tagName === 'SPAN';
    if (!inViewMode) { hint.style.display = 'none'; return; }

    // Keep tooltip on the "more" button up to date with full content
    const full = [state.topicLabel || '', state.topicUrl || ''].filter(Boolean).join(' — ');
    hint.setAttribute('title', full);

    // True overflow => show the button
    const over = el.scrollWidth > el.clientWidth + 1;
    hint.style.display = over ? '' : 'none';
  } catch {}
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

    // host-only local toggles (client-side optimistic + server notify)
    document.addEventListener('ep:specials-toggle', (ev) => {
      if (!state.isHost) return;

      // Read the DOM checkbox AFTER the click has settled (microtask)
      queueMicrotask(() => {
        const el = document.getElementById('menuSpecialsToggle');
        const on = (el ? !!el.checked
                       : (ev && ev.detail && 'on' in ev.detail ? !!ev.detail.on : !state.allowSpecials));

        // Optimistic local update
        state.allowSpecials = on;
        syncMenuFromState();
        renderCards();

        // Tell the server (room-wide)
        try { send(`specials:${on}`); } catch {}
      });
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
    window.addEventListener('resize', () => requestAnimationFrame(syncTopicOverflow));

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
