/* room.js — UI + WS glue for Estimation Poker */
(() => {
  'use strict';

  const TAG = '[ROOM]';
  const $ = (s) => document.querySelector(s);
  const setText = (sel, v) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (el) el.textContent = v ?? '';
  };

  // ---------------- i18n helpers (lightweight) ----------------
  // Cache for messages loaded from /i18n/messages
  const MSG = Object.create(null);

  // Read a message key either from cache, or from a <meta name="msg.KEY">, or fall back
  function t(key, fallback) {
    try {
      if (key && Object.prototype.hasOwnProperty.call(MSG, key)) return MSG[key];
      const meta = document.head && document.head.querySelector(`meta[name="msg.${key}"]`);
      if (meta && typeof meta.content === 'string' && meta.content.length) return meta.content;
    } catch {}
    return fallback;
  }

  // Prefetch message map (non-blocking). Works with I18nController (/i18n/messages).
  async function preloadMessages() {
    const lang = isDe() ? 'de' : 'en';
    try {
      const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(lang)}`, { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') Object.assign(MSG, data);
      }
    } catch {
      /* keep graceful fallbacks via <meta> and hardcoded text */
    }
  }

  // ---------------- Constants ----------------
  const SPECIALS = ['❓', '💬', '☕'];
  const INFINITY_ = '♾️';
  const INFINITY_ALT = '∞'; // backward-compat
  const IDLE_MS_THRESHOLD = 3_600_000; // 60min

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

  // one-time binding guard
  let _topicOverflowResizeBound = false;

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

  function markAlive(name) {
    if (!name) return;
    try { localStorage.setItem(PRESENCE_KEY(name), String(Date.now())); } catch {}
  }

  function shouldToastPresence(name, kind) {
    if (!name) return false;
    if (name === state.youName) return false;
    let last = 0;
    try { last = parseInt(localStorage.getItem(PRESENCE_KEY(name)) || '0', 10) || 0; } catch {}
    const delta = Date.now() - last;
    return delta > PRESENCE_GRACE_MS;
  }

  // Wrap long text for native title tooltips by injecting \n
  function wrapForTitle(text, max = 44) {
    const words = String(text || '').trim().split(/\s+/);
    const out = [];
    let line = '';
    for (let w of words) {
      // break very long tokens/URLs at common boundaries (/, -, _, .)
      if (w.length > max) {
        w = w
          .replace(/(?<=\/)/g, '\n')
          .replace(/(?<=-)/g, '\n')
          .replace(/(?<=_)/g, '\n')
          .replace(/(?<=\.)/g, '\n');
      }
      for (const chunk of w.split('\n')) {
        if (!chunk) continue;
        const need = (line ? line.length + 1 : 0) + chunk.length;
        if (need > max) {
          if (line) out.push(line);
          line = chunk;
        } else {
          line += (line ? ' ' : '') + chunk;
        }
      }
    }
    if (line) out.push(line);
    return out.join('\n');
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

      // --- specials & deck (be robust across server variants) ---
      // Server may send:
      //  (A) m.specials = ["❓","💬","☕"]  -> specials ON (explicit list)
      //      m.specials = []              -> specials OFF (explicit empty)
      //  (B) m.allowSpecials = true|false -> boolean switch
      //  (C) Legacy: m.specialsOff / m.specialsEnabled
      //  (D) nothing -> keep client state
      let specialsList = null;      // if null: don't touch specials in deck
      let allowFromServer = null;   // if null: don't touch state.allowSpecials

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

      // Base deck: server deck or current one
      let deck = Array.isArray(m.cards) ? m.cards.slice() : (Array.isArray(state.cards) ? state.cards.slice() : []);

      // Infinity only for fib.enh
      if (seqId !== 'fib.enh') {
        deck = deck.filter(c => c !== INFINITY_ && c !== INFINITY_ALT);
      }

      // Align deck specials to server's explicit list (including empty)
      if (specialsList !== null) {
        deck = deck.filter(c => !SPECIALS.includes(c)).concat(specialsList);
      }
      state.cards = deck;

      // --- core flags ---
      state.votesRevealed = !!m.votesRevealed;
      state.averageVote   = (m.hasOwnProperty('averageVote') ? m.averageVote : null);
      state.medianVote    = (m.hasOwnProperty('medianVote')  ? m.medianVote  : null);
      state.range         = (m.hasOwnProperty('range')       ? m.range       : null);
      state.consensus     = !!m.consensus;
      state.outliers      = Array.isArray(m.outliers) ? m.outliers : [];

      // --- participants ---
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

      // --- topic / misc ---
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

      // presence freshness
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
        if (isInactive) left.classList.add('inactive');
        li.appendChild(left);

        // Name
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = p.name;
        li.appendChild(name);

        // Right column (chips + actions)
        const right = document.createElement('div');
        right.className = 'row-right';

        // Chips
        if (!state.votesRevealed) {
          // Pre-vote: render a stable mini-chip
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
          } else if (isInactive) {
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

              // Specials keep their special styling (not heat-colored)
              if (!isInfinity && isSpecial) chip.classList.add('special');

              // Heat color for numeric & infinity
              if (!isSpecial) {
                const hue = heatHueForLabel(display);
                if (hue != null) {
                  chip.classList.add('heat');
                  chip.style.setProperty('--chip-heat-h', String(hue));
                }
              }

              // Outlier badge
              if (Array.isArray(state.outliers) && state.outliers.includes(p.name)) {
                chip.classList.add('outlier');
              }

              right.appendChild(chip);
            }
          }
        }

        // Row actions (host → can makeHost / kick non-hosts)
        if (state.isHost && !p.isHost) {
          const makeHostBtn = document.createElement('button');
          makeHostBtn.className = 'row-action host';
          makeHostBtn.type = 'button';
          const labelMakeHost = t('action.makeHost', isDe() ? 'Zum Host machen' : 'Make host');
          makeHostBtn.setAttribute('aria-label', labelMakeHost);
          makeHostBtn.setAttribute('title', labelMakeHost);
          makeHostBtn.innerHTML = '<span class="ra-icon">👑</span>';
          makeHostBtn.addEventListener('click', () => {
            const q = isDe() ? `Host-Rolle an ${p.name} übertragen?` : `Transfer host role to ${p.name}?`;
            if (confirm(q)) send('makeHost:' + encodeURIComponent(p.name));
          });
          right.appendChild(makeHostBtn);

          const kickBtn = document.createElement('button');
          kickBtn.className = 'row-action kick';
          kickBtn.type = 'button';
          const labelKick = t('action.kick', isDe() ? 'Teilnehmer entfernen' : 'Kick participant');
          kickBtn.setAttribute('aria-label', labelKick);
          kickBtn.setAttribute('title', labelKick);
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

  // --- Heat hue helpers ------------------------------------------------------
  function parseVoteNumber(label) {
    if (label == null) return null;
    const s = String(label).trim();
    if (s === '♾️' || s === '♾' || s === '∞') return Infinity;
    if (s === '½' || s === '1/2') return 0.5;
    const num = Number(s.replace(',', '.'));
    return Number.isFinite(num) ? num : null;
  }

  function numericDeckFromState() {
    const nums = (state.cards || [])
      .map(parseVoteNumber)
      .filter(v => v !== null && v !== undefined && !Number.isNaN(v));
    const uniq = [...new Set(nums)].sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
    return uniq;
  }

  const PIVOT_BY_SEQUENCE = {
    'fib.enh': 13,
    'fib.scrum': 13,
    'fib.math': 13,
    'pow2': 32,
  };

  function heatHueForLabel(label) {
    const deck = numericDeckFromState();
    if (!deck.length) return null;

    const v = parseVoteNumber(label);
    if (v == null) return null;

    let idx = deck.findIndex(x => Object.is(x, v));
    if (idx < 0) {
      idx = deck.findIndex(x => x > v);
      if (idx < 0) idx = deck.length - 1;
    }

    const max = Math.max(1, deck.length - 1);
    let t = idx / max; // 0..1

    const pivotLabel = PIVOT_BY_SEQUENCE[state.sequenceId || ''] ?? null;
    let gamma = 1.25; // mild default if no pivot
    if (pivotLabel != null) {
      const pivIdx = deck.findIndex(x => Object.is(x, pivotLabel));
      if (pivIdx > 0) {
        const p = Math.min(0.999, Math.max(0.001, pivIdx / max));
        const g = Math.log(0.5) / Math.log(p);
        if (Number.isFinite(g) && g > 0) gamma = g;
      }
    }

    t = Math.pow(t, gamma);
    const hue = 120 - (t * 120); // 120=green → 0=red
    return Math.round(Math.max(0, Math.min(120, hue)));
  }

  // ---------------- Cards ----------------
  function mySelectedValue() {
    const me = state.participants.find(pp => pp.name === state.youName);
    if (me && me.vote != null && me.vote !== '') return String(me.vote);
    if (state._optimisticVote != null) return String(state._optimisticVote);
    return null;
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

    // split deck
    const deckSpecialsFromState = (state.cards || []).filter(v => SPECIALS.includes(v));
    const deckNumbers           = (state.cards || []).filter(v => !SPECIALS.includes(v));

    // robust fallback for specials
    const specialsCandidate = deckSpecialsFromState.length ? deckSpecialsFromState : SPECIALS.slice();
    const specialsDedupe = [...new Set(specialsCandidate.filter(s => !deckNumbers.includes(s)))];

    // honor host toggle
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
        // name in the payload is ignored server-side (CID binding), kept for BC
        send(`vote:${state.youName}:${label}`);
      });

      grid.appendChild(btn);
    }

    // numeric first
    deckNumbers.forEach(addCardButton);

    // break before specials
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
        const gateMsg = t('reveal.gate', isDe()
          ? 'Es haben noch nicht alle ihre Schätzung abgegeben'
          : 'Not everyone has voted yet');
        revealBtn.setAttribute('title', gateMsg);
        revealBtn.setAttribute('aria-disabled', 'true');
        revealBtn.setAttribute('aria-label', gateMsg);
      } else {
        // Restore base label (room.html already sets i18n title; we remove explicit blocker title)
        revealBtn.removeAttribute('title');
        revealBtn.removeAttribute('aria-disabled');
        // Keep aria-label as provided by room.html (button.reveal)
      }
    }
    if (resetBtn) {
      resetBtn.style.display = showReset ? '' : 'none';
      resetBtn.hidden = !showReset;
    }
  }

  // ---------------- Result bar ----------------
  function renderResultBar() {
    const hasInfinity = !!(
      state.votesRevealed &&
      Array.isArray(state.participants) &&
      state.participants.some(p => p && !p.observer && (p.vote === INFINITY_ || p.vote === INFINITY_ALT))
    );

    const tstr = (v) => (v == null || v === '' ? null : String(v));
    const withInf = (base) => (base != null ? base + (hasInfinity ? ' +♾️' : '') : (hasInfinity ? '♾️' : null));

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

    if (avgEl) {
      const avgTxt = withInf(tstr(state.averageVote));
      avgEl.textContent = avgTxt ?? (state.votesRevealed ? 'N/A' : '');
    }

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

    if (medianWrap) {
      const showM = state.votesRevealed && tstr(state.medianVote) != null;
      medianWrap.hidden = !showM;
      if (showM) setText('#medianVote', withInf(tstr(state.medianVote)));
    }
    if (rangeWrap && rangeSep) {
      const showR = state.votesRevealed && tstr(state.range) != null;
      rangeWrap.hidden = !showR;
      rangeSep.hidden  = !showR;
      if (showR) setText('#rangeVote', withInf(tstr(state.range)));
    }
  }

  // ---------------- Topic row ----------------
  function renderTopic() {
    const row = $('#topicRow'); if (!row) return;

    // show/hide whole row
    row.style.display = state.topicVisible ? '' : 'none';

    // ensure actions container (right side)
    let actions = row.querySelector('.topic-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topic-actions';
      row.appendChild(actions);
    }

    // ensure #topicDisplay exists (SPAN in view mode, INPUT in edit mode)
    let displayEl = row.querySelector('#topicDisplay');

    // helper: fill the display element in view mode
    const renderDisplayContent = (el) => {
      if (state.topicLabel && state.topicUrl) {
        el.innerHTML = `<a href="${encodeURI(state.topicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.topicLabel)}</a>`;
      } else if (state.topicLabel) {
        el.textContent = state.topicLabel;
      } else {
        el.textContent = '–';
      }
      const full = [state.topicLabel || '', state.topicUrl || ''].filter(Boolean).join(' — ');
      const link = el.querySelector && el.querySelector('a');
      (link || el).setAttribute('title', wrapForTitle(full, 44));
    };

    // create (or reuse) the compact “more” button
    let hint = row.querySelector('#topicOverflowHint');
    const ensureHint = () => {
      if (!hint) {
        const btn = document.createElement('button');
        btn.id = 'topicOverflowHint';
        btn.type = 'button';
        btn.className = 'topic-more-btn';
        btn.textContent = isDe() ? 'mehr' : 'more';
        const lab = isDe() ? 'Vollständiges Thema anzeigen' : 'Show full topic';
        const label = t('topic.more', lab); // optional key; falls nicht vorhanden → fallback
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
        hint = btn;
      }
    };

    // Non-hosts: view-only
    if (!state.isHost) {
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
      actions.innerHTML = '';

      requestAnimationFrame(syncTopicOverflow);
      const full = [state.topicLabel || '', state.topicUrl || ''].filter(Boolean).join(' — ');
      hint.setAttribute('title', wrapForTitle(full, 44));
      hint.setAttribute('aria-label', t('topic.more', isDe() ? 'Vollständiges Thema anzeigen' : 'Show full topic'));
      return;
    }

    // Host view/edit modes
    if (!state.topicEditing) {
      // VIEW
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

      const titleEdit  = t('button.editTopic',  isDe() ? 'Bearbeiten'   : 'Edit');
      const titleClear = t('button.clearTopic', isDe() ? 'Feld leeren'  : 'Clear');

      actions.innerHTML =
        `<button id="topicEditBtn"
                 class="icon-button neutral"
                 type="button"
                 title="${escapeHtml(titleEdit)}"
                 aria-label="${escapeHtml(titleEdit)}">✍️</button>
         <button id="topicClearBtn"
                 class="icon-button neutral"
                 type="button"
                 title="${escapeHtml(titleClear)}"
                 aria-label="${escapeHtml(titleClear)}">🗑️</button>`;

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
      // EDIT
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

      if (hint) hint.style.display = 'none';

      const titleSave   = t('button.saveTopic', isDe() ? 'Speichern'  : 'Save');
      const titleCancel = t('button.cancel',    isDe() ? 'Abbrechen'  : 'Cancel');

      actions.innerHTML =
        `<button id="topicSaveBtn"
                 class="icon-button neutral"
                 type="button"
                 title="${escapeHtml(titleSave)}"
                 aria-label="${escapeHtml(titleSave)}">✅</button>
         <button id="topicCancelEditBtn"
                 class="icon-button neutral"
                 type="button"
                 title="${escapeHtml(titleCancel)}"
                 aria-label="${escapeHtml(titleCancel)}">❌</button>`;

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

  function beginTopicEdit() {
    if (!state.isHost) return;
    state.topicEditing = true;
    renderTopic();
  }

  function syncTopicOverflow() {
    try {
      const row  = $('#topicRow'); if (!row) return;
      const el   = row.querySelector('#topicDisplay');
      const hint = row.querySelector('#topicOverflowHint');
      if (!el || !hint) return;

      // only in view mode
      const inViewMode = el && el.tagName === 'SPAN';
      if (!inViewMode) { hint.style.display = 'none'; return; }

      const full = [state.topicLabel || '', state.topicUrl || ''].filter(Boolean).join(' — ');
      hint.setAttribute('title', full);
      hint.setAttribute('aria-label', t('topic.more', isDe() ? 'Vollständiges Thema anzeigen' : 'Show full topic'));

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
      showToast(t('reveal.gate', isDe() ? 'Erst aufdecken, wenn alle gewählt haben.' : 'Reveal only after everyone voted.'));
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
      const tEl = document.createElement('div');
      tEl.className = 'toast';
      tEl.textContent = msg;
      document.body.appendChild(tEl);
      // force reflow for CSS animation
      // eslint-disable-next-line no-unused-expressions
      tEl.offsetHeight;
      setTimeout(() => tEl.remove(), ms + 600);
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

    const okMsg   = t('copy.ok',   isDe() ? 'Link kopiert' : 'Link copied');
    const failMsg = t('copy.fail', isDe() ? 'Kopieren fehlgeschlagen' : 'Copy failed');

    async function handle() {
      const ok = await copyText(inviteUrl());
      const prev = btn.getAttribute('title');
      btn.setAttribute('title', ok ? okMsg : failMsg);
      btn.setAttribute('aria-label', ok ? okMsg : failMsg);
      showToast(ok ? okMsg : failMsg);
      if (prev != null) setTimeout(() => btn.setAttribute('title', prev), 2200);
      else setTimeout(() => btn.removeAttribute('title'), 2200);
    }
    btn.addEventListener('click', (e) => { e.preventDefault(); handle(); });
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(); } });
  }

  // ---------------- Menu & lifecycle events ----------------
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

    // host-only: specials toggle (client optimistic + server notify)
    document.addEventListener('ep:specials-toggle', () => {
      if (!state.isHost) return;
      queueMicrotask(() => {
        const el = document.getElementById('menuSpecialsToggle');
        const on = el ? !!el.checked : !state.allowSpecials;
        state.allowSpecials = on;          // optimistic
        syncMenuFromState();
        renderCards();
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

    // keep the overflow hint in sync on window resizes (bind once)
    if (!_topicOverflowResizeBound) {
      window.addEventListener('resize', () => requestAnimationFrame(syncTopicOverflow));
      _topicOverflowResizeBound = true;
    }

    // NO 'intentionalLeave' on beforeunload anymore
    window.addEventListener('pageshow', () => {
      document.dispatchEvent(new CustomEvent('ep:request-sync', { detail: { room: state.roomCode } }));
      if (!state.connected && (!state.ws || state.ws.readyState !== 1)) connectWS();
    });

    syncSequenceInMenu();
  }

  // ---------------- Misc helpers ----------------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------- Boot ----------------
  function boot() { preloadMessages(); wireOnce(); syncHostClass(); connectWS(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
