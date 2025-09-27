/* room.js — UI + WS glue for Estimation Poker (liveness-hardened)
   - 15s heartbeat pings (ping)
   - Watchdog reconnects if we see no inbound frames for >20s
   - Wake-ups on visibilitychange / focus / online / pageshow (poke + resync)
   - Exponential backoff reconnect w/ jitter
   - English inline comments & "Spectator" wording
   - Name preflight once per (room+name) per tab
*/
(() => {
  'use strict';

  /*** ---------- Small DOM helpers ---------- ***/
  const TAG = '[ROOM]';
  const $ = (s) => document.querySelector(s);
  const setText = (sel, v) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (el) el.textContent = v ?? '';
  };

  /*** ---------- i18n (lightweight) ---------- ***/
  const MSG = Object.create(null);
  function t(key, fallback) {
    try {
      if (key && Object.prototype.hasOwnProperty.call(MSG, key)) return MSG[key];
      const meta = document.head && document.head.querySelector(`meta[name="msg.${key}"]`);
      if (meta && typeof meta.content === 'string' && meta.content.length) return meta.content;
    } catch {}
    return fallback;
  }
  async function preloadMessages() {
    const lang = isDe() ? 'de' : 'en';
    try {
      const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(lang)}`, { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') Object.assign(MSG, data);
      }
    } catch {}
  }

  /*** ---------- Constants ---------- ***/
  const SPECIALS = ['❓', '☕']; // 💬 intentionally removed
  const INFINITY_ = '♾️';
  const INFINITY_ALT = '∞';

  // Liveness knobs (tuned for iOS tab sleeps)
  const HEARTBEAT_MS = 15_000;
  const WATCHDOG_STALE_MS = 20_000;
  const WATCHDOG_TICK_MS  = 5_000;
  const RECO_BASE_MS = 800;
  const RECO_MAX_MS  = 12_000;

  // script dataset / URL params
  const scriptEl = document.querySelector('script[src*="/js/room.js"]') || document.querySelector('script[src*="room.liveness.js"]');
  const ds = (scriptEl && scriptEl.dataset) || {};
  const url = new URL(location.href);

  // Optional: allow disabling specific specials via data-attribute (e.g., data-disabled-specials="☕")
  const DISABLED_SPECIALS = new Set(
    String(ds.disabledSpecials || '')
      .split(',').map(s => s.trim()).filter(Boolean)
  );

  /*** ---------- Client state ---------- ***/
  const state = {
    _lastRenderSig: null,
    _chipAnimShown: false,

    roomCode: ds.room || url.searchParams.get('roomCode') || 'demo',
    youName:  ds.participant || url.searchParams.get('participantName') || 'Guest',
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
    hardRedirect: null,

    // preflight guards
    cidWasNew: true,
    _preflightMarkedOk: false
  };

  /*** ---------- Stable per-tab client id ---------- ***/
  const CIDKEY = 'ep-cid';
  try {
    const existing = sessionStorage.getItem(CIDKEY);
    if (existing) {
      state.cid = existing;
      state.cidWasNew = false;
    } else {
      state.cid = Math.random().toString(36).slice(2) + '-' + Date.now();
      sessionStorage.setItem(CIDKEY, state.cid);
      state.cidWasNew = true;
    }
  } catch {
    state.cid = 'cid-' + Date.now();
    state.cidWasNew = true;
  }

  // Canonicalize URL params (no reload) for shareable links
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

  // One-time binding guard for resize wiring
  let _topicOverflowResizeBound = false;

  /*** ---------- Helpers ---------- ***/
  function normalizeSeq(id) {
    if (!id) return 'fib.scrum';
    const s = String(id).toLowerCase().trim();
    if (s === 'fib-enh') return 'fib.enh';
    if (s === 'fib-math') return 'fib.math';
    if (s === 't-shirt')  return 'tshirt';
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

  // Presence guard for join/leave toasts (suppress self + rapid flaps)
  const PRESENCE_GRACE_MS = 2000;
  const PRESENCE_KEY = (n) => 'ep-presence:' + encodeURIComponent(n);
  function markAlive(name) { if (!name) return; try { localStorage.setItem(PRESENCE_KEY(name), String(Date.now())); } catch {} }
  function shouldToastPresence(name) {
    if (!name || name === state.youName) return false;
    let last = 0; try { last = parseInt(localStorage.getItem(PRESENCE_KEY(name)) || '0', 10) || 0; } catch {}
    return (Date.now() - last) > PRESENCE_GRACE_MS;
  }

  // Wrap long tooltips by injecting \n
  function wrapForTitle(text, max = 44) {
    const words = String(text || '').trim().split(/\s+/);
    const out = []; let line = '';
    for (let w of words) {
      if (w.length > max) {
        w = w.replace(/(?<=\/)/g, '\n').replace(/(?<=-)/g, '\n').replace(/(?<=_)/g, '\n').replace(/(?<=\.)/g, '\n');
      }
      for (const chunk of w.split('\n')) {
        if (!chunk) continue;
        const need = (line ? line.length + 1 : 0) + chunk.length;
        if (need > max) { if (line) out.push(line); line = chunk; }
        else { line += (line ? ' ' : '') + chunk; }
      }
    }
    if (line) out.push(line);
    return out.join('\n');
  }

  /*** ---------- WebSocket + liveness ---------- ***/
  let hbTimer = null;
  let wdTimer = null;
  let rcTimer = null;
  let rcAttempts = 0;
  let lastInboundAt = 0;

  function send(line) { if (state.ws && state.ws.readyState === 1) state.ws.send(line); }

  function startHeartbeat() {
    stopHeartbeat();
    hbTimer = setInterval(() => {
      if (state.ws && state.ws.readyState === 1) {
        try { state.ws.send('ping'); } catch {}
      }
    }, HEARTBEAT_MS);
  }
  function stopHeartbeat() { if (hbTimer) { clearInterval(hbTimer); hbTimer = null; } }

  function startWatchdog() {
    stopWatchdog();
    wdTimer = setInterval(() => {
      const ws = state.ws;
      if (ws && ws.readyState === 1) {
        const age = Date.now() - lastInboundAt;
        if (age > WATCHDOG_STALE_MS) {
          console.warn(TAG, 'watchdog: stale socket (age', age, 'ms) → reconnect');
          try { ws.close(4002, 'stale'); } catch {}
          scheduleReconnect('watchdog-stale');
        }
      } else {
        scheduleReconnect('watchdog-closed');
      }
    }, WATCHDOG_TICK_MS);
  }
  function stopWatchdog() { if (wdTimer) { clearInterval(wdTimer); wdTimer = null; } }

  function scheduleReconnect(reason) {
    if (state.hardRedirect) return;
    if (rcTimer) return;
    const attempt = rcAttempts++;
    const base = Math.min(RECO_MAX_MS, RECO_BASE_MS * Math.pow(2, attempt));
    const jitter = base * (0.3 * Math.random());
    const delay = Math.max(300, base - (base * 0.15) + jitter);
    console.warn(TAG, 'scheduleReconnect', { reason, attempt, delay });
    rcTimer = setTimeout(() => {
      rcTimer = null;
      connectWS();
    }, delay);
  }
  function resetReconnectBackoff() {
    rcAttempts = 0;
    if (rcTimer) { clearTimeout(rcTimer); rcTimer = null; }
  }

  function pokeServerAndSync() {
    try { state.ws && state.ws.readyState === 1 && state.ws.send('ping'); } catch {}
    try { send('requestSync'); } catch {}
    setTimeout(() => { try { send('requestSync'); } catch {} }, 200);
  }

  function wake(reason = 'wake') {
    if (state.hardRedirect) return;
    if (navigator && 'onLine' in navigator && !navigator.onLine) {
      console.info(TAG, 'wake: offline — will wait for "online"');
      return;
    }
    const ws = state.ws;
    if (ws && ws.readyState === 1) {
      console.info(TAG, 'wake:', reason, '→ poke + resync');
      pokeServerAndSync();
    } else {
      console.info(TAG, 'wake:', reason, '→ reconnect now');
      try { ws && ws.close(4003, 'wake-reconnect'); } catch {}
      resetReconnectBackoff();
      connectWS();
    }
  }

  // -------- SINGLE, FINAL VERSION OF connectWS (handles text + JSON) ----------
  function connectWS() {
    const u = wsUrl();

    // Close any existing open/connecting socket before reconnecting
    if (state.ws && (state.ws.readyState === 0 || state.ws.readyState === 1)) {
      try { state.ws.close(4004, 'reconnect'); } catch {}
    }

    console.info(TAG, 'connect →', u);

    let s;
    try { s = new WebSocket(u); }
    catch (e) { console.error(TAG, e); scheduleReconnect('ctor'); return; }

    state.ws = s;
    try { window.__epWs = s; } catch {}

    s.onopen = () => {
      state.connected = true;
      lastInboundAt = Date.now();
      resetReconnectBackoff();
      startHeartbeat();
      startWatchdog();

      // identify + ask for fresh snapshot
      try { send('rename:' + encodeURIComponent(state.youName)); } catch {}
      try { send('requestSync'); } catch {}
      setTimeout(() => { try { send('requestSync'); } catch {} }, 400);

      try { renderParticipants(); } catch {}
    };

    s.onclose = (ev) => {
      state.connected = false;
      stopHeartbeat();
      stopWatchdog();

      if (state.hardRedirect) { location.href = state.hardRedirect; return; }

      // 4000 = room closed by host, 4001 = kicked by host
      if (ev.code === 4000 || ev.code === 4001) {
        try { sessionStorage.setItem('ep-flash', ev.code === 4001 ? 'kicked' : 'roomClosed'); } catch {}
        location.replace('/');
        return;
      }

      // 4005 = name collision → only bounce on first-time tab entries
      if (ev.code === 4005) {
        if (state.cidWasNew) {
          const redirectUrl =
            `/invite?roomCode=${encodeURIComponent(state.roomCode)}` +
            `&participantName=${encodeURIComponent(state.youName)}` +
            `&nameTaken=1`;
          state.hardRedirect = redirectUrl;
          location.replace(redirectUrl);
          return;
        }
        showToast(isDe() ? 'Name bereits in Verwendung' : 'Name already in use');
        return;
      }

      console.warn(TAG, 'onclose', ev.code, ev.reason || '');
      scheduleReconnect('close');
    };

    s.onerror = (e) => {
      console.warn(TAG, 'ws error', e);
    };

    s.onmessage = (ev) => {
      // Bump watchdog on any inbound frame
      lastInboundAt = Date.now();

      // Heartbeat reply from server
      if (ev.data === 'pong') return;

      // ---- legacy plain-text roster frames ---------------------------------
      if (typeof ev.data === 'string') {
        if (ev.data.startsWith('participantJoined:')) {
          const name = ev.data.slice('participantJoined:'.length).trim();
          if (name) { addParticipantLocal(name); try { renderParticipants(); } catch {} }
          return;
        }
        if (ev.data.startsWith('participantLeft:')) {
          const name = ev.data.slice('participantLeft:'.length).trim();
          if (name) { removeParticipantLocal(name); try { renderParticipants(); } catch {} }
          return;
        }
      }
      // ----------------------------------------------------------------------

      // Small JSON messages (compat)
      try {
        if (typeof ev.data === 'string' && ev.data.charAt(0) === '{') {
          const msg = JSON.parse(ev.data);
          switch (msg && msg.type) {
            case 'participantJoined': {
              const name = (msg.name || '').trim();
              if (name) { addParticipantLocal(name); try { renderParticipants && renderParticipants(); } catch {} }
              return;
            }
            case 'participantLeft': {
              const name = (msg.name || '').trim();
              if (name) { removeParticipantLocal(name); try { renderParticipants && renderParticipants(); } catch {} }
              return;
            }
            case 'kicked': {
              if (msg.redirect) {
                try { window.location.assign(msg.redirect); } catch { window.location.href = msg.redirect; }
              }
              return;
            }
          }
        }
      } catch { /* ignore compat parse errors */ }

      // Full JSON room-state messages
      try {
        const msg = JSON.parse(ev.data);
        try { (window.__epVU ||= []).push(msg); } catch {}
        handleMessage(msg);
      } catch (e) {
        console.warn(TAG, 'Bad message', e);
      }
    };
  }
  // -------- END connectWS ----------------------------------------------------

  /*** ---------- Messages ---------- ***/
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
        addParticipantLocal((m.name || '').trim());
        try { renderParticipants && renderParticipants(); } catch {}
        break;
      }
      case 'participantLeft': {
        removeParticipantLocal((m.name || '').trim());
        try { renderParticipants && renderParticipants(); } catch {}
        break;
      }
      case 'participantRenamed': {
        const from = m.from || '', to = m.to || '';
        if (from !== state.youName) showToast(isDe() ? `${from} heißt jetzt ${to}` : `${from} is now ${to}`);
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

  function renderSigFromState() {
    const P = (state.participants || [])
      .map(p => ({ n: p?.name || '', v: (p?.vote ?? ''), o: !!p?.spectator, d: !!p?.disconnected }))
      .sort((a, b) => a.n.localeCompare(b.n));

    return JSON.stringify({
      r: !!state.votesRevealed,
      a: state.averageVote ?? null,
      m: state.medianVote ?? null,
      g: state.range ?? null,
      c: !!state.consensus,
      s: state.sequenceId || '',
      ar: !!state.autoRevealEnabled,
      tv: !!state.topicVisible,
      tl: state.topicLabel || '',
      tu: state.topicUrl || null,
      sp: !!state.allowSpecials,
      P
    });
  }

  function applyVoteUpdate(m) {
    try {
      const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj || {}, k);

      // --- sequence id ---
      if (has(m, 'sequenceId')) state.sequenceId = normalizeSeq(m.sequenceId);
      else if (!state.sequenceId) state.sequenceId = 'fib.scrum';

      // --- specials & deck ---
      let specialsList = null;
      let allowFromServer = null;

      if (has(m, 'specials') && Array.isArray(m.specials)) {
        specialsList = m.specials.slice();
        allowFromServer = specialsList.length > 0;
      }
      if (has(m, 'allowSpecials')) {
        allowFromServer = !!m.allowSpecials;
        if (specialsList === null) specialsList = allowFromServer ? SPECIALS.slice() : [];
      }
      if (has(m, 'specialsOff')) {
        allowFromServer = !m.specialsOff;
        if (specialsList === null) specialsList = (!m.specialsOff) ? SPECIALS.slice() : [];
      }
      if (has(m, 'specialsEnabled')) {
        allowFromServer = !!m.specialsEnabled;
        if (specialsList === null) specialsList = m.specialsEnabled ? SPECIALS.slice() : [];
      }
      if (allowFromServer !== null) state.allowSpecials = allowFromServer;

      let deck = has(m, 'cards') && Array.isArray(m.cards) ? m.cards.slice()
               : Array.isArray(state.cards) ? state.cards.slice()
               : [];

      const seqId = state.sequenceId || 'fib.scrum';
      if (seqId !== 'fib.enh') deck = deck.filter(c => c !== INFINITY_ && c !== INFINITY_ALT);

      if (specialsList !== null) deck = deck.filter(c => !SPECIALS.includes(c)).concat(specialsList);
      deck = deck.filter(c => !DISABLED_SPECIALS.has(String(c)));
      state.cards = deck;

      // --- core flags / stats ---
      if (has(m, 'votesRevealed') || has(m, 'cardsRevealed') || has(m, 'revealed')) {
        state.votesRevealed = !!(has(m, 'votesRevealed') ? m.votesRevealed
                              : has(m, 'cardsRevealed')   ? m.cardsRevealed
                              : m.revealed);
      }

      if (has(m, 'averageVote') || has(m, 'average')) {
        state.averageVote = has(m, 'averageVote') ? m.averageVote : m.average;
      }
      if (has(m, 'medianVote') || has(m, 'median')) {
        state.medianVote = has(m, 'medianVote') ? m.medianVote : m.median;
      }
      if (has(m, 'range')) {
        state.range = m.range;
      } else if (has(m, 'min') || has(m, 'max')) {
        const min = m.min ?? null, max = m.max ?? null;
        state.range = (min != null && max != null) ? `${min}–${max}` : null;
      }

      if (has(m, 'consensus'))          state.consensus = !!m.consensus;
      if (has(m, 'outliers') && Array.isArray(m.outliers)) state.outliers = m.outliers.slice();
      if (has(m, 'autoRevealEnabled'))  state.autoRevealEnabled = !!m.autoRevealEnabled;

      // --- topic / misc ---
      if (has(m, 'topicVisible')) state.topicVisible = !!m.topicVisible;
      if (has(m, 'topicLabel'))   state.topicLabel   = m.topicLabel || '';
      if (has(m, 'topicUrl'))     state.topicUrl     = m.topicUrl || null;

      // --- participants (preserve previous vote if omitted) ---
      if (has(m, 'participants') && Array.isArray(m.participants)) {
        const prevByName = Object.fromEntries((state.participants || []).map(p => [p.name, p]));
        const next = [];

        for (const p of m.participants) {
          if (!p) continue;
          const prev = prevByName[p.name] || null;

          const name = (p.name || prev?.name || '').trim();
          if (!name) continue;

          const vote = has(p, 'vote') ? (p.vote ?? null) : (prev ? (prev.vote ?? null) : null);

          const spectator =
            has(p, 'spectator')     ? !!p.spectator :
            has(p, 'participating') ? (p.participating === false) :
            !!prev?.spectator;

          const participating =
            has(p, 'participating') ? (p.participating !== false) :
            (!spectator && (prev ? (prev.participating !== false) : true));

          next.push({
            name,
            vote,
            spectator,
            participating,
            disconnected: has(p,'disconnected') ? !!p.disconnected : !!prev?.disconnected,
            away:         has(p,'away')         ? !!p.away         : !!prev?.away,
            isHost:       has(p,'isHost')       ? !!p.isHost       : !!prev?.isHost
          });
        }

        if (next.length) state.participants = next;
      }

      // who am I (re-evaluate host)
      const me = state.participants.find(p => p && p.name === state.youName);
      state.isHost = !!(me && me.isHost);
      state._hostKnown = true;
      if (me && me.vote != null) state._optimisticVote = null;

      // --- render ---
      syncHostClass();
      renderParticipants();
      renderCards();
      renderResultBar();
      renderTopic();
      renderAutoReveal();

      try { (state.participants || []).forEach(p => { if (p && !p.disconnected) markAlive(p.name); }); } catch {}

      requestAnimationFrame(() => { syncMenuFromState(); syncSequenceInMenu(); });
      if (!document.documentElement.hasAttribute('data-ready')) {
        document.documentElement.setAttribute('data-ready', '1');
      }
    } catch (e) {
      console.error('[ROOM] applyVoteUpdate failed', e);
    }

    // Safety: ensure we show "self" locally if server sends an empty list initially
    if (Array.isArray(state.participants) &&
        !state.participants.some(p => p && p.name === state.youName)) {
      state.participants.unshift({
        name: state.youName || 'You',
        vote: null, disconnected:false, away:false,
        isHost: !!state.isHost, participating:true, spectator:false
      });
    }
  }

  /*** ---------- Participants ---------- ***/
  function isSpectator(p) {
    return !!(p && (p.spectator === true || p.participating === false));
  }

  function renderParticipants() {
    const ul = document.querySelector('#liveParticipantList');
    if (!ul) return;

    try {
      const list = (state.participants || [])
        .map(p => (typeof p === 'string' ? { name: p } : p))
        .filter(p => p && p.name);

      const frag = document.createDocumentFragment();
      list.forEach(p => {
        if (!p || !p.name) return;

        const li = document.createElement('li');
        li.className = 'participant-row';

        const isInactive = !!p.disconnected || !!p.away;
        if (isInactive) li.classList.add('disconnected');
        if (p.isHost)    li.classList.add('is-host');
        if (isSpectator(p)) li.classList.add('spectator');

        const left = document.createElement('span');
        left.className = 'participant-icon' + (p.isHost ? ' host' : '');
        let icon = '👤';
        if (p.isHost)              icon = '👑';
        else if (isSpectator(p))   icon = '👁️';
        else if (isInactive)       icon = '💤';
        left.textContent = icon;
        left.setAttribute('aria-hidden', 'true');
        if (isInactive) left.classList.add('inactive');
        li.appendChild(left);

        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = p.name;
        li.appendChild(name);

        const right = document.createElement('div');
        right.className = 'row-right';

        if (!state.votesRevealed) {
          if (isSpectator(p)) {
            const eye = document.createElement('span');
            eye.className = 'mini-chip spectator';
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
          if (isSpectator(p)) {
            const eye = document.createElement('span');
            eye.className = 'mini-chip spectator';
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

              if (!isInfinity && isSpecial) chip.classList.add('special');

              if (!isSpecial) {
                const hue = heatHueForLabel(display);
                if (hue != null) {
                  chip.classList.add('heat');
                  chip.style.setProperty('--chip-heat-h', String(hue));
                }
              }

              if (Array.isArray(state.outliers) && state.outliers.includes(p.name)) {
                chip.classList.add('outlier');
              }

              right.appendChild(chip);
            }
          }
        }

        if (state.isHost && !p.isHost) {
          const makeHostBtn = document.createElement('button');
          makeHostBtn.className = 'row-action host';
          makeHostBtn.type = 'button';
          makeHostBtn.dataset.action = 'host';
          makeHostBtn.dataset.name = p.name;
          const labelMakeHost = t('action.makeHost', isDe() ? 'Zum Host machen' : 'Make host');
          makeHostBtn.setAttribute('aria-label', labelMakeHost);
          makeHostBtn.setAttribute('title', labelMakeHost);
          makeHostBtn.innerHTML = '<span class="ra-icon">👑</span>';
          right.appendChild(makeHostBtn);

          const kickBtn = document.createElement('button');
          kickBtn.className = 'row-action kick';
          kickBtn.type = 'button';
          kickBtn.dataset.action = 'kick';
          kickBtn.dataset.name = p.name;
          const labelKick = t('action.kick', isDe() ? 'Teilnehmer entfernen' : 'Kick participant');
          kickBtn.setAttribute('aria-label', labelKick);
          kickBtn.setAttribute('title', labelKick);
          kickBtn.innerHTML = '<span class="ra-icon">❌</span>';
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

  /*** ---------- Heat hue helpers ---------- ***/
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
  const PIVOT_BY_SEQUENCE = { 'fib.enh': 13, 'fib.scrum': 13, 'fib.math': 13, 'pow2': 32 };
  function heatHueForLabel(label) {
    const deck = numericDeckFromState();
    if (!deck.length) return null;
    const v = parseVoteNumber(label);
    if (v == null) return null;

    let idx = deck.findIndex(x => Object.is(x, v));
    if (idx < 0) { idx = deck.findIndex(x => x > v); if (idx < 0) idx = deck.length - 1; }

    const max = Math.max(1, deck.length - 1);
    let t = idx / max;

    const pivotLabel = PIVOT_BY_SEQUENCE[state.sequenceId || ''] ?? null;
    let gamma = 1.25;
    if (pivotLabel != null) {
      const pivIdx = deck.findIndex(x => Object.is(x, pivotLabel));
      if (pivIdx > 0) {
        const p = Math.min(0.999, Math.max(0.001, pivIdx / max));
        const g = Math.log(0.5) / Math.log(p);
        if (Number.isFinite(g) && g > 0) gamma = g;
      }
    }

    t = Math.pow(t, gamma);
    const hue = 120 - (t * 120);
    return Math.round(Math.max(0, Math.min(120, hue)));
  }

  /*** ---------- Cards ---------- ***/
  function mySelectedValue() {
    const me = state.participants.find(pp => pp.name === state.youName);
    if (me && me.vote != null && me.vote !== '') return String(me.vote);
    if (state._optimisticVote != null) return String(state._optimisticVote);
    return null;
  }
  function allEligibleVoted() {
    const elig = state.participants.filter(p => p && !isSpectator(p) && !p.disconnected);
    if (!elig.length) return false;
    return elig.every(p => p.vote != null && String(p.vote) !== '');
  }

  function msg(key, en, de) {
    const fallback = isDe() ? (de != null ? de : en) : en;
    return t(key, fallback);
  }

  function renderCards() {
    const grid = $('#cardGrid'); if (!grid) return;
    grid.innerHTML = '';

    const me = state.participants.find(pp => pp.name === state.youName);
    const isSpectatorMe = !!(me && isSpectator(me));
    const disabled = state.votesRevealed || isSpectatorMe;

    const deckSpecialsFromState = (state.cards || [])
      .filter(v => SPECIALS.includes(v) && !DISABLED_SPECIALS.has(String(v)));
    const deckNumbers = (state.cards || [])
      .filter(v => !SPECIALS.includes(v) && !DISABLED_SPECIALS.has(String(v)));

    const specialsCandidate = deckSpecialsFromState.length ? deckSpecialsFromState : SPECIALS.slice();
    const specialsDedupe = [...new Set(specialsCandidate.filter(s => !deckNumbers.includes(s)))];

    const specials = state.allowSpecials ? specialsDedupe : [];

    const selectedVal = mySelectedValue();

    function addCardButton(val) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.val = String(val);
      btn.textContent = String(val);

      if (SPECIALS.includes(btn.dataset.val)) {
        if (btn.dataset.val === '❓') {
          const tip = msg('card.tip.question',
            'I still have questions about this requirement.',
            'Ich habe noch offene Fragen zu dieser Anforderung.');
          btn.setAttribute('title', tip); btn.setAttribute('aria-label', tip);
        } else if (btn.dataset.val === '☕') {
          const tip = msg('card.tip.coffee',
            'I need a short break…',
            'Ich brauche eine Pause…');
          btn.setAttribute('title', tip); btn.setAttribute('aria-label', tip);
        }
      }

      if (btn.dataset.val === INFINITY_ || btn.dataset.val === INFINITY_ALT) btn.classList.add('card-infinity');
      if (disabled) btn.disabled = true;
      if (selectedVal != null && String(selectedVal) === btn.dataset.val) btn.classList.add('selected');

      grid.appendChild(btn);
    }

    deckNumbers.forEach(addCardButton);

    if (specials.length) {
      const br = document.createElement('div');
      br.className = 'grid-break';
      br.setAttribute('aria-hidden', 'true');
      grid.appendChild(br);
      specials.forEach(addCardButton);
    }

    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');
    const hardGateOK = !state.hardMode || allEligibleVoted();

    const showReveal = (!state.votesRevealed && state.isHost);
    const showReset  = ( state.votesRevealed && state.isHost);

    if (revealBtn) {
      revealBtn.hidden   = !showReveal;
      revealBtn.disabled = !hardGateOK;

      if (!hardGateOK) {
        const gateMsg = t('reveal.gate', isDe()
          ? 'Es haben noch nicht alle ihre Schätzung abgegeben'
          : 'Not everyone has voted yet');
        revealBtn.setAttribute('title', gateMsg);
        revealBtn.setAttribute('aria-disabled', 'true');
        revealBtn.setAttribute('aria-label', gateMsg);
      } else {
        revealBtn.removeAttribute('title');
        revealBtn.removeAttribute('aria-disabled');
      }
    }

    if (resetBtn) {
      resetBtn.hidden = !showReset;
    }
  } // end renderCards()

  /*** ---------- Result bar ---------- ***/
  function renderResultBar() {
    document.body.classList.toggle('votes-revealed', !!state.votesRevealed);

    const row = $('#resultRow');
    if (row) {
      if (state.votesRevealed) row.classList.remove('is-hidden');
      else                     row.classList.add('is-hidden');
    }

    if (state.votesRevealed) {
      if (state._chipAnimShown) document.body.classList.add('no-chip-anim');
      else { document.body.classList.remove('no-chip-anim'); state._chipAnimShown = true; }
    } else {
      document.body.classList.remove('no-chip-anim');
      state._chipAnimShown = false;
    }

    const hasInfinity = !!(
      state.votesRevealed &&
      Array.isArray(state.participants) &&
      state.participants.some(p => p && !isSpectator(p) && (p.vote === INFINITY_ || p.vote === INFINITY_ALT))
    );

    const toStr  = (v) => (v == null || v === '' ? null : String(v));
    const withInf = (base) => (base != null ? base + (hasInfinity ? ' +♾️' : '') : (hasInfinity ? '♾️' : null));

    const avgWrap    = document.querySelector('#resultLabel .label-average');
    const consEl     = document.querySelector('#resultLabel .label-consensus');
    const medianWrap = $('#medianWrap');
    const rangeWrap  = $('#rangeWrap');
    const rangeSep   = $('#rangeSep');
    const avgEl      = $('#averageVote');
    const medianSep  = document.getElementById('medianSep') || document.querySelector('#resultRow .sep');

    const CONS_LABEL = t('label.consensus', isDe() ? '🎉 Konsens' : '🎉 Consensus');

    if (avgEl) {
      const avgTxt = withInf(toStr(state.averageVote));
      avgEl.textContent = avgTxt ?? (state.votesRevealed ? 'N/A' : '');
    }

    if (row) {
      if (state.consensus) {
        row.classList.add('consensus');
        if (avgWrap) avgWrap.hidden = true;
        if (consEl) { consEl.hidden = false; consEl.textContent = CONS_LABEL; }
        if (medianSep) { medianSep.hidden = true; medianSep.setAttribute('aria-hidden', 'true'); }
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

    let showMedian = false;
    if (medianWrap) {
      showMedian = state.votesRevealed && toStr(state.medianVote) != null;
      medianWrap.hidden = !showMedian;
      if (showMedian) setText('#medianVote', withInf(toStr(state.medianVote)));
    }
    if (medianSep) {
      medianSep.hidden = !showMedian;
      medianSep.setAttribute('aria-hidden', String(!showMedian));
    }

    if (rangeWrap && rangeSep) {
      const showRange = state.votesRevealed && toStr(state.range) != null;
      rangeWrap.hidden = !showRange;
      rangeSep.hidden  = !showRange;
      if (showRange) setText('#rangeVote', withInf(toStr(state.range)));
    }
  }

  /*** ---------- Topic row (optimistic topic handling) ---------- ***/
  function clientParseTopic(input) {
    const MAX_LABEL = 140;
    const s = (input || '').trim();
    if (!s) return { label: null, url: null };

    const isUrl = s.startsWith('http://') || s.startsWith('https://');
    const jiraKeyMatch = s.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
    const label = jiraKeyMatch ? jiraKeyMatch[1] : (s.length > MAX_LABEL ? (s.slice(0, MAX_LABEL) + '…') : s);
    const url2 = isUrl ? s : null;

    return { label, url: url2 };
  }

  function renderTopic() {
    const row = $('#topicRow'); if (!row) return;
    row.style.display = state.topicVisible ? '' : 'none';

    let actions = row.querySelector('.topic-actions');
    if (!actions) { actions = document.createElement('div'); actions.className = 'topic-actions'; row.appendChild(actions); }

    let displayEl = row.querySelector('#topicDisplay');

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

    let hint = row.querySelector('#topicOverflowHint');
    const ensureHint = () => {
      if (!hint) {
        const btn = document.createElement('button');
        btn.id = 'topicOverflowHint';
        btn.type = 'button';
        btn.className = 'topic-more-btn';
        btn.textContent = isDe() ? 'mehr' : 'more';
        const lab = isDe() ? 'Vollständiges Thema anzeigen' : 'Show full topic';
        const label = t('topic.more', lab);
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
        hint = btn;
      }
    };

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

    if (!state.topicEditing) {
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
        `<button id="topicEditBtn" class="icon-button neutral" type="button"
                title="${escapeHtml(titleEdit)}" aria-label="${escapeHtml(titleEdit)}">✍️</button>
         <button id="topicClearBtn" class="icon-button neutral" type="button"
                title="${escapeHtml(titleClear)}" aria-label="${escapeHtml(titleClear)}">🗑️</button>`;

      const editBtn  = $('#topicEditBtn');
      const clearBtn = $('#topicClearBtn');
      if (editBtn)  editBtn.addEventListener('click', beginTopicEdit);
      if (clearBtn) clearBtn.addEventListener('click', () => {
        state.topicLabel = '';
        state.topicUrl = null;
        state.topicEditing = false;
        renderTopic();
        send('topicSave:' + encodeURIComponent(''));
      });

      requestAnimationFrame(syncTopicOverflow);
    } else {
      if (!displayEl || displayEl.tagName !== 'INPUT') {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'topic-inline-input';
        inp.id = 'topicDisplay';
        inp.placeholder = isDe() ? 'JIRA-Link einfügen oder Key eingeben' : 'Paste JIRA link or type key';
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
        `<button id="topicSaveBtn" class="icon-button neutral" type="button"
                title="${escapeHtml(titleSave)}" aria-label="${escapeHtml(titleSave)}">✅</button>
         <button id="topicCancelEditBtn" class="icon-button neutral" type="button"
                title="${escapeHtml(titleCancel)}" aria-label="${escapeHtml(titleCancel)}">❌</button>`;

      const saveBtn   = $('#topicSaveBtn');
      const cancelBtn = $('#topicCancelEditBtn');

      const doSave = () => {
        const val = displayEl.value || '';
        const parsed = clientParseTopic(val);
        state.topicLabel = parsed.label;
        state.topicUrl = parsed.url;
        state.topicEditing = false;
        renderTopic();
        send('topicSave:' + encodeURIComponent(val));
      };
      const doCancel = () => { state.topicEditing = false; renderTopic(); };

      if (saveBtn)   saveBtn.addEventListener('click', doSave);
      if (cancelBtn) cancelBtn.addEventListener('click', doCancel);
      displayEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); doSave(); }
        if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
      });
    }
  }

  function beginTopicEdit() { if (!state.isHost) return; state.topicEditing = true; renderTopic(); }

  function syncTopicOverflow() {
    try {
      const row  = $('#topicRow'); if (!row) return;
      const el   = row.querySelector('#topicDisplay');
      const hint = row.querySelector('#topicOverflowHint');
      if (!el || !hint) return;

      const inViewMode = el && el.tagName === 'SPAN';
      if (!inViewMode) { hint.style.display = 'none'; return; }

      const full = [state.topicLabel || '', state.topicUrl || ''].filter(Boolean).join(' — ');
      hint.setAttribute('title', full);
      hint.setAttribute('aria-label', t('topic.more', isDe() ? 'Vollständiges Thema anzeigen' : 'Show full topic'));

      const over = el.scrollWidth > el.clientWidth + 1;
      hint.style.display = over ? '' : 'none';
    } catch {}
  }

  /*** ---------- Auto-reveal badge ---------- ***/
  function renderAutoReveal() {
    const preSt  = document.querySelector('.pre-vote #arStatus');
    const menuSt = document.querySelector('#appMenuOverlay #menuArStatus');
    const statusText = state.autoRevealEnabled ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');
    if (preSt)  preSt.textContent  = statusText;
    if (menuSt) menuSt.textContent = statusText;
  }

  /*** ---------- Menu sync ---------- ***/
  function setRowDisabled(inputId, disabled) {
    const input = document.getElementById(inputId);
    const row = input ? input.closest('.menu-item.switch') : null;
    if (input) { input.disabled = !!disabled; input.setAttribute('aria-disabled', String(!!disabled)); }
    if (row) { row.classList.toggle('disabled', !!disabled); }
  }
  function syncMenuFromState() {
    setRowDisabled('menuAutoRevealToggle', !state.isHost && state._hostKnown);
    setRowDisabled('menuTopicToggle',      !state.isHost && state._hostKnown);
    setRowDisabled('menuSpecialsToggle',   !state.isHost && state._hostKnown);
    setRowDisabled('menuHardModeToggle',   !state.isHost && state._hostKnown);

    const mTgl = $('#menuTopicToggle'); const mSt = $('#menuTopicStatus');
    if (mTgl) { mTgl.checked = !!state.topicVisible; mTgl.setAttribute('aria-checked', String(!!state.topicVisible)); }
    if (mSt)  mSt.textContent = state.topicVisible ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');

    const me = state.participants.find(p => p.name === state.youName);
    const spectatorMe = !!(me && isSpectator(me));
    const mPTgl = $('#menuParticipationToggle');
    const mPSt  = $('#menuPartStatus');
    if (mPTgl) { mPTgl.checked = !spectatorMe; mPTgl.setAttribute('aria-checked', String(!spectatorMe)); }
    if (mPSt)  mPSt.textContent = !spectatorMe
      ? t('menu.participation.estimating', isDe() ? 'Ich schätze mit' : "I'm estimating")
      : t('menu.participation.spectator',  isDe() ? 'Zuschauer:in'   : 'Spectator');

    const mARTgl = $('#menuAutoRevealToggle');
    if (mARTgl) { mARTgl.checked = !!state.autoRevealEnabled; mARTgl.setAttribute('aria-checked', String(!!state.autoRevealEnabled)); }

    const mSPTgl = $('#menuSpecialsToggle'); const mSPSt = $('#menuSpecialsStatus');
    if (mSPTgl) { mSPTgl.checked = !!state.allowSpecials; mSPTgl.setAttribute('aria-checked', String(!!state.allowSpecials)); }
    if (mSPSt) mSPSt.textContent = state.allowSpecials ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');

    const mHRTgl = $('#menuHardModeToggle'); const mHRSt = $('#menuHardStatus');
    if (mHRTgl) { mHRTgl.checked = !!state.hardMode; mHRTgl.setAttribute('aria-checked', String(!!state.hardMode)); }
    if (mHRSt)  mHRSt.textContent = state.hardMode ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');
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

  /*** ---------- Global actions ---------- ***/
  function revealCards() {
    if (state.hardMode && !allEligibleVoted()) {
      showToast(t('reveal.gate', isDe() ? 'Erst aufdecken, wenn alle gewählt haben.' : 'Reveal only after everyone voted.'));
      return;
    }
    send('revealCards');
  }
  function resetRoom() { send('resetRoom'); }
  window.revealCards = revealCards;
  window.resetRoom   = resetRoom;

  /*** ---------- Toast & copy helpers ---------- ***/
  function showToast(msg, ms = 2600) {
    try {
      const tEl = document.createElement('div');
      tEl.className = 'toast';
      tEl.textContent = msg;
      document.body.appendChild(tEl);
      // force reflow (start CSS animation)
      // eslint-disable-next-line no-unused-expressions
      tEl.offsetHeight;
      setTimeout(() => tEl.remove(), ms + 600);
    } catch {}
  }
  function inviteUrl() { return `${location.origin}/invite?roomCode=${encodeURIComponent(state.roomCode)}`; }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
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
    const candidates = ['#copyRoomLink','#copyRoomLinkBtn','#copyRoomBtn','.room-with-actions .icon-button','.main-info .icon-button']
      .map(sel => $(sel)).filter(Boolean);
    const btn = candidates[0]; if (!btn) return;

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

  /*** ---------- Menu & lifecycle events ---------- ***/
  function wireMenuEvents() {
    document.addEventListener('ep:close-room', () => {
      if (!state.isHost) return;
      const msg2 = isDe() ? 'Diesen Raum für alle schließen?' : 'Close this room for everyone?';
      if (confirm(msg2)) send('closeRoom');
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

      const me = state.participants.find(p => p && p.name === state.youName);
      if (me) {
        me.spectator = !estimating;
        me.participating = estimating;
        renderParticipants();
        renderCards();
        syncMenuFromState();
      }

      send(`participation:${estimating}`);
    });

    document.addEventListener('ep:specials-toggle', () => {
      if (!state.isHost) return;
      queueMicrotask(() => {
        const el = document.getElementById('menuSpecialsToggle');
        const on = el ? !!el.checked : !state.allowSpecials;
        state.allowSpecials = on;
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

  /*** ---------- Delegated UI handlers (cards + host/kick) ---------- ***/
  function wireDelegatedHandlers() {
    // Cards
    const grid = $('#cardGrid');
    if (grid && !grid.__epBound) {
      grid.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest && e.target.closest('button[data-val]');
        if (!btn || btn.disabled) return;

        const label = btn.dataset.val;
        if (!label) return;

        // If already selected, do nothing
        if (mySelectedValue() === label) return;

        // Optimistic selection
        state._optimisticVote = label;
        try { grid.querySelectorAll('button[data-val].selected').forEach(b => b.classList.remove('selected')); } catch {}
        btn.classList.add('selected');

        try { send(`vote:${state.youName}:${label}`); } catch {}
      });
      grid.__epBound = true;
    }

    // Host/Kick (participants list)
    const list = $('#liveParticipantList');
    if (list && !list.__epBound) {
      list.addEventListener('click', (e) => {
        const hostBtn = e.target && e.target.closest && e.target.closest('button.row-action.host[data-action="host"]');
        if (hostBtn) {
          if (!state.isHost) return;
          const name = hostBtn.dataset.name || '';
          if (!name) return;
          const q = isDe() ? `Host-Rolle an ${name} übertragen?` : `Transfer host role to ${name}?`;
          if (confirm(q)) send('makeHost:' + encodeURIComponent(name));
          return;
        }
        const kickBtn = e.target && e.target.closest && e.target.closest('button.row-action.kick[data-action="kick"]');
        if (kickBtn) {
          if (!state.isHost) return;
          const name = kickBtn.dataset.name || '';
          if (!name) return;
          const q = isDe() ? `${name} wirklich entfernen?` : `Remove ${name}?`;
          if (confirm(q)) send('kick:' + encodeURIComponent(name));
        }
      });
      list.__epBound = true;
    }
  }

  function wireOnce() {
    bindCopyLink();
    wireMenuEvents();
    wireDelegatedHandlers();

    const row = $('#topicRow');
    if (row) {
      row.addEventListener('click', (e) => {
        if (!state.isHost || state.topicEditing) return;
        if (state.topicLabel) return;
        if (e.target.closest('button,a,input')) return;
        beginTopicEdit();
      });
    }

    if (!_topicOverflowResizeBound) {
      window.addEventListener('resize', () => requestAnimationFrame(syncTopicOverflow));
      _topicOverflowResizeBound = true;
    }

    // Lifecycle: aggressive wake-ups to recover from iOS sleeps
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wake('visibility');
    }, true);
    window.addEventListener('focus',  () => wake('focus'),  true);
    window.addEventListener('online', () => wake('online'), true);
    window.addEventListener('pageshow', () => { wake('pageshow'); }, true);

    startWatchdog();

    // Connect only if we are not already redirecting away
    if (!state.hardRedirect && !state.connected && (!state.ws || state.ws.readyState !== 1)) connectWS();

    syncSequenceInMenu();
  }

  /*** ---------- Misc helpers ---------- ***/
  function addParticipantLocal(name) {
    if (!name) return;

    if (state?.participants && typeof state.participants.add === 'function') {
      state.participants.add(name);
      return;
    }

    if (Array.isArray(state?.participants)) {
      const has = state.participants.some(p =>
        (typeof p === 'string') ? (p === name) : (p && p.name === name)
      );
      if (!has) {
        state.participants.push({
          name,
          vote: null,
          disconnected: false,
          away: false,
          isHost: false,
          participating: true,
          spectator: false
        });
      }
      return;
    }

    if (state?.participantsByName && typeof state.participantsByName.set === 'function') {
      if (!state.participantsByName.has(name)) state.participantsByName.set(name, { name });
    } else if (state?.participantsByName && typeof state.participantsByName === 'object') {
      state.participantsByName[name] = state.participantsByName[name] || { name };
    }
    if (state?.room?.participants && typeof state.room.participants.add === 'function') {
      state.room.participants.add(name);
    } else if (Array.isArray(state?.room?.participants)) {
      if (!state.room.participants.includes(name)) state.room.participants.push(name);
    }
  }

  function removeParticipantLocal(name) {
    if (!name) return;

    if (state?.participants && typeof state.participants.delete === 'function') {
      state.participants.delete(name);
    } else if (Array.isArray(state?.participants)) {
      const idx = state.participants.findIndex(p =>
        (typeof p === 'string') ? (p === name) : (p && p.name === name)
      );
      if (idx !== -1) state.participants.splice(idx, 1);
    }

    if (state?.participantsByName && typeof state.participantsByName.delete === 'function') {
      state.participantsByName.delete(name);
    } else if (state?.participantsByName && typeof state.participantsByName === 'object') {
      delete state.participantsByName[name];
    }

    if (state?.room?.participants && typeof state.room.participants.delete === 'function') {
      state.room.participants.delete(name);
    } else if (Array.isArray(state?.room?.participants)) {
      const j = state.room.participants.findIndex(p =>
        (typeof p === 'string') ? (p === name) : (p && p.name === name)
      );
      if (j !== -1) state.room.participants.splice(j, 1);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function rerenderAll() {
    renderParticipants();
    renderCards();
    renderResultBar();
    renderTopic();
    renderAutoReveal();
    syncMenuFromState();
    syncSequenceInMenu();
    wireDelegatedHandlers(); // ensure delegation survives full rerenders
  }

  async function onLangChange() {
    await preloadMessages();
    rerenderAll();
  }

  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'attributes' && m.attributeName === 'lang') {
        onLangChange();
        break;
      }
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  document.addEventListener('ep:lang-changed', onLangChange);

  /*** ---------- Name preflight: run once per (room+name) per tab ---------- ***/
  async function preflightNameCheck() {
    // Never on reload/back-forward navigations
    let isReloadLike = false;
    try {
      const nav = performance?.getEntriesByType?.('navigation')?.[0];
      if (nav && (nav.type === 'reload' || nav.type === 'back_forward')) {
        isReloadLike = true;
      }
    } catch {}
    if (isReloadLike) return;

    const pfKey = `ep-pf-ok:${state.roomCode}:${state.youName}`;

    try {
      if (sessionStorage.getItem(pfKey) === '1') {
        state._preflightMarkedOk = true;
        return;
      }
    } catch {}

    try {
      const preflightParam = (url && url.searchParams && url.searchParams.get('preflight')) || null;
      if (preflightParam === '1') {
        try { sessionStorage.setItem(pfKey, '1'); state._preflightMarkedOk = true; } catch {}
        return;
      }
    } catch {}

    try {
      const apiUrl = `/api/rooms/${encodeURIComponent(state.roomCode)}/name-available?name=${encodeURIComponent(state.youName)}`;
      const resp = await fetch(apiUrl, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });

      if (resp.ok) {
        const data = await resp.json();

        if (data && data.available === false) {
          const redirectUrl = `/invite?roomCode=${encodeURIComponent(state.roomCode)}&participantName=${encodeURIComponent(state.youName)}&nameTaken=1`;
          state.hardRedirect = redirectUrl;
          location.replace(redirectUrl);
          return;
        }

        try { sessionStorage.setItem(pfKey, '1'); state._preflightMarkedOk = true; } catch {}
      }
    } catch {
      // best-effort only
    }
  }

  /*** ---------- Boot ---------- ***/
  function seedSelfPlaceholder() {
    state.participants = [{
      name: state.youName || 'You',
      vote: null,
      disconnected: false,
      away: false,
      isHost: !!state.isHost,
      participating: true,
      spectator: false
    }];
    try { renderParticipants(); } catch {}
  }

  async function boot() {
    preloadMessages();

    await preflightNameCheck();
    if (state.hardRedirect) return;

    syncHostClass();
    seedSelfPlaceholder();

    try {
      if (!document.documentElement.hasAttribute('data-ready')) {
        document.documentElement.setAttribute('data-ready', '1');
      }
    } catch {}

    wireOnce(); // starts WS/connect, watchdog, delegated handlers, etc.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})(); // end IIFE
