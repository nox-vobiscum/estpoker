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
  const SPECIALS = ['❓', '☕']; // 💬 removed
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

  // Allow disabling specific specials via data-attribute (e.g., data-disabled-specials="☕")
  const DISABLED_SPECIALS = new Set(
    String(ds.disabledSpecials || '')
      .split(',').map(s => s.trim()).filter(Boolean)
  );

  /*** ---------- Client state ---------- ***/
  const state = {
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
    selfSpectator: false, // local mirror for immediate UI response to participation toggle

    // topic edit
    topicEditing: false,

    // UI helpers
    _optimisticVote: null,
    hardRedirect: null,

    // preflight guards
    cidWasNew: true,
    _preflightMarkedOk: false,

    // short pending guard for local sequence changes
    _pendingSeq: null,
    _pendingSeqUntil: 0
  };

  /*** ---------- Stable per-tab client id ---------- ***/
  const CIDKEY = 'ep-cid';
  try {
    const existing = sessionStorage.getItem(CIDKEY);
    if (existing) { state.cid = existing; state.cidWasNew = false; }
    else {
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
  let _topicBound = false;

  /*** ---------- Helpers ---------- ***/
  function normalizeSeq(id) {
    if (!id) return 'fib.scrum';
    const s = String(id).toLowerCase().trim();
    if (s === 'fib-enh') return 'fib.enh';
    if (s === 'fib-math') return 'fib.math';
    if (s === 't-shirt')  return 'tshirt';
    return s;
  }

    /*** ---------- Early bridge for programmatic sequence changes ---------- ***/
    // Some tests (and potential integrations) dispatch on window; others on document.
    // Bind early so we don't miss events that might fire right after data-ready.
    function onSequenceChange(ev) {
      const id = normalizeSeq(ev?.detail?.id || ev?.detail?.sequenceId);
      if (!id) return;
      // Sequence remains host-only; guests are ignored once host info is known.
      if (state._hostKnown && !state.isHost) return;

      applyLocalSequence(id);   // optimistic UI update
      notifySequence(id);       // tell the server + request echo
    }

    // Bind on both targets; capture=true to be resilient to shadowing/bubbling quirks.
    document.addEventListener('ep:sequence-change', onSequenceChange, { capture: true });
    window.addEventListener('ep:sequence-change', onSequenceChange, { capture: true });


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

  function syncHostClass() {
    document.body.classList.toggle('is-host', !!state.isHost);
  }

  // Early sequence-change event bridge (binds before data-ready)
    (function bindEarlySeqBridge() {
    try {
      if (window.__epSeqBridgeBound) return;
      window.__epSeqBridgeBound = true;

      const applyWanted = (wanted) => {
        // Respect host-gate once known
        if (state._hostKnown && !state.isHost) return;

        const current = normalizeSeq(state.sequenceId || 'fib.scrum');
        if (current === wanted && !state._pendingSeq) return;

        applyLocalSequence(wanted);
        notifySequence(wanted);
      };

      const onSeq = (ev) => {
        const raw = ev?.detail?.id ?? ev?.detail?.sequenceId;
        const id = normalizeSeq(raw);
        if (!id) return;

        // 1) immediately
        applyWanted(id);

        // 2) once more on the next macrotask — survives a late bootstrap/render pass
        setTimeout(() => {
          const cur = normalizeSeq(state.sequenceId || 'fib.scrum');
          if (cur !== id) applyWanted(id);
        }, 80);

        // 3) and once after the next frame (covers animation/layout swaps)
        requestAnimationFrame(() => {
          const cur = normalizeSeq(state.sequenceId || 'fib.scrum');
          if (cur !== id) applyWanted(id);
        });
      };

      document.addEventListener('ep:sequence-change', onSeq, { capture: false });
      window.addEventListener('ep:sequence-change', onSeq, { capture: false });
    } catch {}
  })();

  // Presence guard (suppress join/leave toasts for self + rapid flaps)
  const PRESENCE_KEY = (n) => 'ep-presence:' + encodeURIComponent(n);
  function markAlive(name) { if (!name) return; try { localStorage.setItem(PRESENCE_KEY(name), String(Date.now())); } catch {} }

  // Wrap long tooltips by injecting \n  (no lookbehind → broader browser support)
  function wrapForTitle(text, max = 44) {
    const words = String(text || '').trim().split(/\s+/);
    const out = []; let line = '';
    for (let w of words) {
      if (w.length > max) {
        // Break after separators: / - _ .
        w = w.replace(/[\/\-_\.]/g, m => m + '\n');
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

  /*** ---------- Deck bootstrap & number formatting ---------- ***/
  function defaultDeck(seqId = 'fib.scrum', allowSpecials = true) {
    const base = ['0', '1/2', '1', '2', '3', '5', '8', '13', '20', '40', '100'];
    const withInfinity = [...base, '♾️']; // only for fib.enh
    const core = (seqId === 'fib.enh') ? withInfinity : base;
    const specials = allowSpecials ? ['❓','☕'] : [];
    return [...core, ...specials];
  }

  function ensureBootstrapDeck() {
    if (!Array.isArray(state.cards) || state.cards.length === 0) {
      state.sequenceId = normalizeSeq(state.sequenceId || 'fib.scrum');
      let deck = defaultDeck(state.sequenceId, state.allowSpecials);
      if (state.sequenceId !== 'fib.enh') {
        deck = deck.filter(c => c !== INFINITY_ && c !== INFINITY_ALT);
      }
      deck = deck.filter(c => !DISABLED_SPECIALS.has(String(c)));
      state.cards = deck;
    }
  }

  function fmtNumber(n){
    try {
      return new Intl.NumberFormat(isDe() ? 'de' : 'en', { maximumFractionDigits: 2 }).format(n);
    } catch { return String(n); }
  }
  function fmtStat(val){
    if (val == null || val === '') return null;
    const s = String(val).trim();
    if (s === '∞' || s === '♾️') return s;
    if (s === '½' || s === '1/2') return isDe() ? '0,5' : '0.5';
    const x = Number(s.replace(',', '.'));
    return Number.isFinite(x) ? fmtNumber(x) : s;
  }
  function fmtRange(s){
    if (s == null || s === '') return null;
    const parts = String(s).split(/[-–—]/);
    if (parts.length === 2) return `${fmtStat(parts[0].trim())}–${fmtStat(parts[1].trim())}`;
    return String(s);
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
          console.warn(TAG, 'watchdog: stale socket → reconnect');
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

  // Single, final version of connectWS (handles text + JSON)
  function connectWS() {
    const u = wsUrl();

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

      if (ev.code === 4000 || ev.code === 4001) {
        try { sessionStorage.setItem('ep-flash', ev.code === 4001 ? 'kicked' : 'roomClosed'); } catch {}
        location.replace('/');
        return;
      }

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
      lastInboundAt = Date.now();

      if (ev.data === 'pong') return;

      // Legacy plain-text roster frames first
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
      } catch { /* ignore and fall through */ }

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

  /*** ---------- Apply room state ---------- ***/
  function applyVoteUpdate(m) {
    try {
      const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj || {}, k);

      // sequence id (guard against reverting a very recent local change)
      if (has(m, 'sequenceId')) {
        const incoming = normalizeSeq(m.sequenceId);
        const now = Date.now();
        if (state._pendingSeq && now < state._pendingSeqUntil) {
          // Ignore mismatching old server snapshot during short pending window
          if (incoming === state._pendingSeq) {
            state.sequenceId = incoming;       // server confirms our choice
            state._pendingSeq = null;
            state._pendingSeqUntil = 0;
          }
        } else {
          state.sequenceId = incoming;
        }
      } else if (!state.sequenceId) {
        state.sequenceId = 'fib.scrum';
      }

      // mirror into menu radios immediately
      updateAllSeqRadiosChecked(state.sequenceId);

      // specials / deck
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

      const seqId = state.sequenceId || 'fib.scrum';

      // If server didn’t send cards, derive from the sequence
      let deck;
      if (has(m, 'cards') && Array.isArray(m.cards)) {
        deck = m.cards.slice();
      } else {
        deck = defaultDeck(seqId, state.allowSpecials);
      }

      // Infinity only for enh
      if (seqId !== 'fib.enh') deck = deck.filter(c => c !== INFINITY_ && c !== INFINITY_ALT);

      // Apply server specials (if provided)
      if (specialsList !== null) {
        deck = deck.filter(c => !SPECIALS.includes(c)).concat(specialsList);
      }

      // Honor local disabled specials
      deck = deck.filter(c => !DISABLED_SPECIALS.has(String(c)));

      // Safety
      if (!deck.length) {
        deck = defaultDeck(seqId, state.allowSpecials);
        if (seqId !== 'fib.enh') deck = deck.filter(c => c !== INFINITY_ && c !== INFINITY_ALT);
      }
      state.cards = deck;

      // core flags / stats
      if (has(m, 'votesRevealed') || has(m, 'cardsRevealed') || has(m, 'revealed')) {
        state.votesRevealed = !!(has(m, 'votesRevealed') ? m.votesRevealed
                              : has(m, 'cardsRevealed')   ? m.cardsRevealed
                              : m.revealed);
      }

      if (has(m, 'averageVote') || has(m, 'average'))  state.averageVote = has(m, 'averageVote') ? m.averageVote : m.average;
      if (has(m, 'medianVote') || has(m, 'median'))    state.medianVote  = has(m, 'medianVote')  ? m.medianVote  : m.median;
      if (has(m, 'range'))                              state.range       = m.range;
      else if (has(m, 'min') || has(m, 'max')) {
        const min = m.min ?? null, max = m.max ?? null;
        state.range = (min != null && max != null) ? `${min}–${max}` : null;
      }

      if (has(m, 'consensus'))          state.consensus = !!m.consensus;
      if (has(m, 'outliers') && Array.isArray(m.outliers)) state.outliers = m.outliers.slice();
      if (has(m, 'autoRevealEnabled'))  state.autoRevealEnabled = !!m.autoRevealEnabled;

      // topic (protect user edits)
      if (!state.topicEditing) {
        if (has(m, 'topicVisible')) state.topicVisible = !!m.topicVisible;
        if (has(m, 'topicLabel'))   state.topicLabel   = m.topicLabel || '';
        if (has(m, 'topicUrl'))     state.topicUrl     = m.topicUrl || null;
      } else {
        state._topicIncomingWhileEditing = { label: m.topicLabel, url: m.topicUrl };
      }

      // participants; only mark host-known if authoritative data is present
      let hostInfoUpdated = false;

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

        const meNow = state.participants.find(p => p && p.name === state.youName);
        if (meNow && typeof meNow.isHost === 'boolean') {
          state.isHost = !!meNow.isHost;
          state.selfSpectator = !!(meNow.spectator === true || meNow.participating === false);
          hostInfoUpdated = true;
        }
      }

      // optional flat isHost on message
      if (!hostInfoUpdated && has(m, 'isHost')) {
        state.isHost = !!m.isHost;
        hostInfoUpdated = true;
      }

      if (hostInfoUpdated) {
        state._hostKnown = true;
      }

      const me = state.participants.find(p => p && p.name === state.youName);
      if (me && me.vote != null) state._optimisticVote = null;

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
  function isSpectator(p) { return !!(p && (p.spectator === true || p.participating === false)); }

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

        // SR-only host label (inside icon cell, no visual change)
        const srLabel = t('label.host', 'Host');
        if (p.isHost) {
          const sr = document.createElement('span');
          sr.className = 'host-label sr-only';
          sr.textContent = srLabel;
          left.appendChild(sr);
        }

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

              if (Array.isArray(state.outliers) && state.outliers.includes(p.name)) chip.classList.add('outlier');

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

  // --- Host/Kick short labels (integrated) -----------------------------------
  // Visible label: "Host" | "Kick"
  // Tooltip/aria: keep long, localized strings from i18n (title/aria-label)
  (function () {
    'use strict';

    const SHORT = { host: 'Host', kick: 'Kick' };

    function shortifyHostActionLabels(root = document) {
      const list = root.querySelector('#liveParticipantList');
      if (!list) return;

      list.querySelectorAll('.row-right .row-action').forEach(btn => {
        const labelEl = btn.querySelector('.ra-label');
        if (!labelEl) return;

        // Cache/derive long (localized) text from attrs or current label
        if (!btn.dataset.longLabel) {
          const current = (labelEl.textContent || '').trim();
          const longLabel =
            btn.getAttribute('title') ||
            btn.getAttribute('aria-label') ||
            current;
          if (longLabel) btn.dataset.longLabel = longLabel;
        }

        // Ensure tooltip / a11y stay long + localized
        if (btn.dataset.longLabel) {
          btn.setAttribute('title', btn.dataset.longLabel);
          btn.setAttribute('aria-label', btn.dataset.longLabel);
        }

        // Set short, visible label
        labelEl.textContent = btn.classList.contains('kick') ? SHORT.kick : SHORT.host;
        labelEl.style.whiteSpace = 'nowrap'; // guard against wrapping when devtools shrink width
      });
    }

    function installHostActionShortener() {
      shortifyHostActionLabels();

      // Re-apply whenever the list mutates (rows added/updated)
      const list = document.getElementById('liveParticipantList');
      if (list) {
        const mo = new MutationObserver(() => shortifyHostActionLabels());
        mo.observe(list, { childList: true, subtree: true });
      }

      // Re-apply on language changes (tooltips change via i18n)
      window.addEventListener('est:lang-change', () => {
        // Drop cached longLabel so we pick up the new translation
        document.querySelectorAll('#liveParticipantList .row-right .row-action')
          .forEach(b => { delete b.dataset.longLabel; });
        shortifyHostActionLabels();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installHostActionShortener, { once: true });
    } else {
      // Run after current init tick
      queueMicrotask(installHostActionShortener);
    }
  })();


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
    const isSpectatorMe = state.selfSpectator || !!(me && isSpectator(me));
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
      const label = String(val);
      btn.textContent = label;
      btn.dataset.value = label;

      if (SPECIALS.includes(label)) {
        if (label === '❓') {
          const tip = msg('card.tip.question',
            'I still have questions about this requirement.',
            'Ich habe noch offene Fragen zu dieser Anforderung.');
          btn.setAttribute('title', tip); btn.setAttribute('aria-label', tip);
        } else if (label === '☕') {
          const tip = msg('card.tip.coffee',
            'I need a short break…',
            'Ich brauche eine Pause…');
          btn.setAttribute('title', tip); btn.setAttribute('aria-label', tip);
        }
      }

      if (label === INFINITY_ || label === INFINITY_ALT) btn.classList.add('card-infinity');
      if (disabled) btn.disabled = true;
      if (selectedVal != null && String(selectedVal) === label) btn.classList.add('selected');

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

    // Optimistic: until host is known, do not hide the reveal button.
    // The server will reject a non-host reveal anyway; this avoids false negatives just after room creation.
    const showReveal = (!state.votesRevealed && (state.isHost || !state._hostKnown));
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

  // SR announcement: concise sentence for screen readers (English only)
  function announceResultForSR_EN() {
    const sink = document.getElementById('resultAnnounce');
    if (!sink) return;

    if (!state.votesRevealed) { sink.textContent = ''; return; }

    const toS = (v) => (v == null || v === '' ? null : String(v));
    const avg    = toS(fmtStat(state.averageVote));
    const median = toS(fmtStat(state.medianVote));
    let   range  = toS(fmtRange(state.range));
    if (range) range = range.replace('–', ' to ');

    let msg = '';
    if (state.consensus && avg) {
      msg = `🎉 Consensus ${avg}`;
    } else {
      const parts = [];
      if (avg)    parts.push(`Average: ${avg}`);
      if (median) parts.push(`Median: ${median}`);
      if (range)  parts.push(`Range: ${range}`);
      msg = parts.join(', ');
    }
    sink.textContent = msg;
  }

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
      const avgTxt = withInf(toStr(fmtStat(state.averageVote)));
      avgEl.textContent = avgTxt ?? (state.votesRevealed ? 'N/A' : '');
    }

    if (row) {
      if (state.consensus) {
        row.classList.add('consensus');
        if (avgWrap)  avgWrap.hidden = true;
        if (consEl) { consEl.hidden = false; consEl.textContent = CONS_LABEL; }
        if (medianSep) { medianSep.hidden = true; medianSep.setAttribute('aria-hidden', 'true'); }
        if (medianWrap) medianWrap.hidden = true;
        if (rangeSep)  rangeSep.hidden  = true;
        if (rangeWrap) rangeWrap.hidden = true;
        // SR announce in consensus branch
        announceResultForSR_EN();
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
      if (showMedian) setText('#medianVote', withInf(toStr(fmtStat(state.medianVote))));
    }
    if (medianSep) {
      medianSep.hidden = !showMedian;
      medianSep.setAttribute('aria-hidden', String(!showMedian));
    }

    if (rangeWrap && rangeSep) {
      const showRange = state.votesRevealed && toStr(state.range) != null;
      rangeWrap.hidden = !showRange;
      rangeSep.hidden  = !showRange;
      if (showRange) setText('#rangeVote', withInf(toStr(fmtRange(state.range))));
    }

    announceResultForSR_EN();
  }

  /*** ---------- Topic row (robust, delegated, optimistic) ---------- ***/
  function clientParseTopic(input) {
    const MAX_LABEL = 140;
    const s = String(input || '').trim();
    if (!s) return { label: null, url: null };

    const isUrl = s.startsWith('http://') || s.startsWith('https://');
    const jiraKeyMatch = s.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
    const label = jiraKeyMatch ? jiraKeyMatch[1] : (s.length > MAX_LABEL ? (s.slice(0, MAX_LABEL) + '…') : s);
    const url2 = isUrl ? s : null;
    return { label, url: url2 };
  }

  function beginTopicEdit() {
    if (!state.isHost) return;
    state.topicEditing = true;
    if (state._topicDraft == null) state._topicDraft = state.topicLabel || '';
    renderTopic();
  }

  function ensureTopicDelegates() {
    const row = document.querySelector('#topicRow');
    if (!row || row.__topicDelegatesBound) return;
    row.__topicDelegatesBound = true;

    const act = (id) => {
      if (!state.isHost) return;

      const doClear = () => {
        state.topicLabel = '';
        state.topicUrl = null;
        state.topicEditing = false;
        state._topicDraft = null;
        renderTopic();
        try { send('topicSave:' + encodeURIComponent('')); } catch {}
      };
      const doSave = () => {
        const input = row.querySelector('#topicDisplay');
        const raw = (input && input.tagName === 'INPUT') ? input.value : (state._topicDraft ?? '');
        const parsed = clientParseTopic(raw);
        state.topicLabel = parsed.label;
        state.topicUrl = parsed.url;
        state.topicEditing = false;
        state._topicDraft = null;
        renderTopic();
        try { send('topicSave:' + encodeURIComponent(raw)); } catch {}
      };
      const doCancel = () => {
        state.topicEditing = false;
        state._topicDraft = null;
        renderTopic();
      };

      if (id === 'topicEditBtn')   return beginTopicEdit();
      if (id === 'topicClearBtn')  return doClear();
      if (id === 'topicSaveBtn')   return doSave();
      if (id === 'topicCancelEditBtn') return doCancel();
    };

    // Early capture
    row.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const btn = e.target && e.target.closest &&
        e.target.closest('#topicEditBtn,#topicClearBtn,#topicSaveBtn,#topicCancelEditBtn');
      if (!btn) return;
      e.preventDefault?.();
      act(btn.id);
    }, { capture: true, passive: false });

    // Fallback click
    row.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest &&
        e.target.closest('#topicEditBtn,#topicClearBtn,#topicSaveBtn,#topicCancelEditBtn');
      if (!btn) return;
      act(btn.id);
    }, { capture: true, passive: true });
  }

  function renderTopic() {
    const row = $('#topicRow'); if (!row) return;
    row.style.display = state.topicVisible ? '' : 'none';
    row.setAttribute('data-visible', state.topicVisible ? '1' : '0');
    // Keep [hidden] attribute and "is-hidden" class in sync
    if (state.topicVisible) {
      row.removeAttribute('hidden');
      row.classList.remove('is-hidden');
    } else {
      row.setAttribute('hidden', '');
      row.classList.add('is-hidden');
    }

    // Ensure actions container
    let actions = row.querySelector('.topic-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topic-actions';
      row.appendChild(actions);
    }

    // Ensure a single delegate is bound
    ensureTopicDelegates();

    // Helper to render read-only text/link (no innerHTML)
    const renderDisplayContent = (el) => {
      el.textContent = ''; // reset
      if (state.topicLabel && state.topicUrl) {
        const a = document.createElement('a');
        a.rel = 'noopener noreferrer';
        a.target = '_blank';
        a.textContent = state.topicLabel;
        try { a.href = state.topicUrl; } catch { a.href = '#'; }
        el.appendChild(a);
      } else if (state.topicLabel) {
        el.textContent = state.topicLabel;
      } else {
        el.textContent = '–';
      }
      const full = [state.topicLabel || '', state.topicUrl || ''].filter(Boolean).join(' — ');
      const link = el.querySelector && el.querySelector('a');
      (link || el).setAttribute('title', wrapForTitle(full, 44));
    };

    // "more" hint
    let hint = row.querySelector('#topicOverflowHint');
    const ensureHint = () => {
      if (!hint) {
        const btn = document.createElement('button');
        btn.id = 'topicOverflowHint';
        btn.type = 'button';
        btn.className = 'topic-more-btn';
        btn.textContent = 'more';
        const label = t('topic.more', 'Show full topic');
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
        hint = btn;
      }
    };

    let displayEl = row.querySelector('#topicDisplay');

    // Non-host: read-only
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
      hint.setAttribute('aria-label', t('topic.more', 'Show full topic'));
      return;
    }

    // Host: not editing
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

      const titleEdit  = t('button.editTopic',  'Edit');
      const titleClear = t('button.clearTopic', 'Clear');

      actions.innerHTML =
        `<button id="topicEditBtn" class="icon-button neutral" type="button"
                 title="${escapeHtml(titleEdit)}" aria-label="${escapeHtml(titleEdit)}">✍️</button>
         <button id="topicClearBtn" class="icon-button neutral" type="button"
                 title="${escapeHtml(titleClear)}" aria-label="${escapeHtml(titleClear)}">🗑️</button>`;

      requestAnimationFrame(syncTopicOverflow);
      return;
    }

    // Host: editing
    if (!displayEl || displayEl.tagName !== 'INPUT') {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'topic-inline-input';
      inp.id = 'topicDisplay';
      inp.placeholder = t('topic.placeholder', 'Paste JIRA link or type key');
      inp.value = state._topicDraft != null ? state._topicDraft : (state.topicLabel || '');
      inp.addEventListener('input', () => { state._topicDraft = inp.value; });
      if (displayEl) displayEl.replaceWith(inp);
      else row.insertBefore(inp, row.firstChild ? row.firstChild.nextSibling : null);
      displayEl = inp;
      setTimeout(() => { try { displayEl.focus(); displayEl.select(); } catch {} }, 0);
    }
    if (hint) hint.style.display = 'none';

    const titleSave   = t('button.saveTopic', 'Save');
    const titleCancel = t('button.cancel',    'Cancel');

    actions.innerHTML =
      `<button id="topicSaveBtn" class="icon-button neutral" type="button"
               title="${escapeHtml(titleSave)}" aria-label="${escapeHtml(titleSave)}">✅</button>
       <button id="topicCancelEditBtn" class="icon-button neutral" type="button"
               title="${escapeHtml(titleCancel)}" aria-label="${escapeHtml(titleCancel)}">❌</button>`;

    // Local keyboard support
    displayEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); const b = $('#topicSaveBtn');   b && b.click(); }
      if (e.key === 'Escape') { e.preventDefault(); const b = $('#topicCancelEditBtn'); b && b.click(); }
    }, { passive: false });
  }

  function syncTopicOverflow() {
    try {
      const row  = $('#topicRow');
      if (!row) return;

      const el   = row.querySelector('#topicDisplay');
      const hint = row.querySelector('#topicOverflowHint');
      if (!el || !hint) return;

      const inViewMode = el && el.tagName === 'SPAN';
      if (!inViewMode) {
        hint.style.display = 'none';
        return;
      }

      const full = [state.topicLabel || '', state.topicUrl || '']
        .filter(Boolean)
        .join(' — ');
      hint.setAttribute('title', full);
      hint.setAttribute('aria-label', t('topic.more', 'Show full topic'));

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
    if (input) {
      input.disabled = !!disabled;
      input.setAttribute('aria-disabled', String(!!disabled));
    }
    if (row) row.classList.toggle('disabled', !!disabled);
  }

  // --- sequence radio helpers ---
  function seqVariants(id) {
    const s = normalizeSeq(id || 'fib.scrum');
    return [s, s.replace('.', '-')]; // e.g. fib.enh / fib-enh
  }
  function updateAllSeqRadiosChecked(seqIdRaw) {
    const vars = new Set(seqVariants(seqIdRaw));
    const radios = document.querySelectorAll('input[type="radio"][name="menu-seq"]');
    radios.forEach(r => {
      const v = String(r.value || '').toLowerCase().trim();
      const checked = vars.has(v);
      if (r.checked !== checked) r.checked = checked;
      r.setAttribute('aria-checked', checked ? 'true' : 'false');
    });
  }
  function syncSequenceRadiosAndMenu() {
    const radios = document.querySelectorAll('input[type="radio"][name="menu-seq"]');
    const shouldDisable = state._hostKnown ? !state.isHost : false;

    radios.forEach(r => {
      r.disabled = !!shouldDisable;
      r.setAttribute('aria-disabled', String(!!shouldDisable));
      const lab = r.closest('label');
      if (lab) lab.classList.toggle('disabled', !!shouldDisable);
    });

    updateAllSeqRadiosChecked(state.sequenceId || 'fib.scrum');
  }

  // --- robust reconciliation for radio selection (covers label/script/.check) ---
  function domSelectedSeq() {
    const el = document.querySelector('input[type="radio"][name="menu-seq"]:checked');
    return el ? normalizeSeq(el.value) : null;
  }
  function reconcileSeqFromDOM() {
    const sel = domSelectedSeq();
    if (!sel) return;
    if (state._hostKnown && !state.isHost) {
      updateAllSeqRadiosChecked(state.sequenceId || 'fib.scrum');
      return;
    }
    if (sel !== (state.sequenceId || 'fib.scrum')) {
      applyLocalSequence(sel);
      notifySequence(sel);
    } else {
      updateAllSeqRadiosChecked(sel);
    }
  }

  function syncMenuFromState() {
    // Disable guest controls once host info is known
    setRowDisabled('menuAutoRevealToggle', !state.isHost && state._hostKnown);
    setRowDisabled('menuTopicToggle',      !state.isHost && state._hostKnown);
    setRowDisabled('menuSpecialsToggle',   !state.isHost && state._hostKnown);
    setRowDisabled('menuHardModeToggle',   !state.isHost && state._hostKnown);

    const mTgl = $('#menuTopicToggle'); const mSt = $('#menuTopicStatus');
    if (mTgl) { mTgl.checked = !!state.topicVisible; mTgl.setAttribute('aria-checked', String(!!state.topicVisible)); }
    if (mSt)  mSt.textContent = state.topicVisible ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');

    const me = state.participants.find(p => p.name === state.youName);
    const spectatorMe = state.selfSpectator || !!(me && isSpectator(me));

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
    syncSequenceRadiosAndMenu();
  }

  document.addEventListener('ep:menu-open', () => {
    wireSequenceRadios();           // ensure radios are wired even on first open
    wireMenuTogglesDom();
    syncMenuFromState();
    syncSequenceInMenu();
    // if Playwright already toggled the radio, reconcile now
    queueMicrotask(reconcileSeqFromDOM);
  });

  // Wire real DOM switches to our app events (idempotent)
  function wireMenuTogglesDom() {
    const byId = (id) => document.getElementById(id);

    const bindSwitch = (id, handler) => {
      const el = byId(id);
      if (!el || el.__bound) return;
      el.__bound = true;
      el.addEventListener('change', () => {
        const checked = !!el.checked;
        el.setAttribute('aria-checked', String(checked));
        handler(checked, el);
      }, { passive: true });
    };

    // Participation: user-controlled, not host-gated
    bindSwitch('menuParticipationToggle', (on /*= estimating*/, _el) => {
      document.dispatchEvent(new CustomEvent('ep:participation-toggle', { detail: { estimating: on } }));
    });

    // Host-only switches: revert UI immediately if a guest tries to toggle
    const hostGuard = (next, el) => {
      if (state._hostKnown && !state.isHost) {
        const cur = !!el.checked;
        el.checked = !cur;
        el.setAttribute('aria-checked', String(!cur));
        return;
      }
      next();
    };

    bindSwitch('menuAutoRevealToggle', (on, el) => hostGuard(() => {
      document.dispatchEvent(new CustomEvent('ep:auto-reveal-toggle', { detail: { on } }));
    }, el));

    bindSwitch('menuTopicToggle', (on, el) => hostGuard(() => {
      document.dispatchEvent(new CustomEvent('ep:topic-toggle', { detail: { on } }));
    }, el));

    bindSwitch('menuSpecialsToggle', (on, el) => hostGuard(() => {
      document.dispatchEvent(new CustomEvent('ep:specials-toggle', { detail: { on } }));
    }, el));

    bindSwitch('menuHardModeToggle', (on, el) => hostGuard(() => {
      document.dispatchEvent(new CustomEvent('ep:hard-mode-toggle', { detail: { on } }));
    }, el));
  }


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

  // Helper that applies the local UI state for a sequence change
  function applyLocalSequence(id) {
    const seq = normalizeSeq(id);
    if (!seq) return;

    // short window to ignore old server snapshot
    const now = Date.now();
    state._pendingSeq = seq;
    state._pendingSeqUntil = now + 1200;

    state.sequenceId = seq;
    state.votesRevealed = false;
    state._optimisticVote = null;

    let deck = defaultDeck(seq, state.allowSpecials);
    if (seq !== 'fib.enh') deck = deck.filter(c => c !== INFINITY_ && c !== INFINITY_ALT);
    deck = deck.filter(c => !DISABLED_SPECIALS.has(String(c)));
    state.cards = deck;

    renderCards();
    renderResultBar();
    syncSequenceInMenu();
  }

  // Send with limited backward-compat payloads + fast server echo
  function notifySequence(id) {
    const norm = normalizeSeq(id);
    const val = encodeURIComponent(norm);
    const payloads = [
      `sequence:${val}`,      // primary
      `seq:${val}`,           // compat
      `setSequence:${val}`,   // compat
    ];
    for (const p of payloads) {
      try { send(p); } catch {}
    }
    // Nudge server so tests don't wait for a lazy echo
    try { pokeServerAndSync(); } catch {}
    setTimeout(() => { try { pokeServerAndSync(); } catch {} }, 120);
  }

  function wireSequenceRadios() {
    const root = document.getElementById('menuSeqChoice');
    if (!root || root.__seqBound) return;
    root.__seqBound = true;

    // regular change
    root.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.name !== 'menu-seq') return;

      const id = normalizeSeq(t.value);
      if (!id) return;

      if (state._hostKnown && !state.isHost) {
        updateAllSeqRadiosChecked(state.sequenceId || 'fib.scrum');
        return;
      }

      applyLocalSequence(id);
      updateAllSeqRadiosChecked(id);
      notifySequence(id);
    });

    // also react to input (some UIs dispatch both)
    root.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.name !== 'menu-seq') return;
      queueMicrotask(reconcileSeqFromDOM);
    });
  }

  // Global capture fallback for radios, resilient to DOM swaps/re-mounts
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;

    // Guest-bounce for menu checkboxes (toggles) — EXCEPT participation (user-controlled)
    if (t.type === 'checkbox' && t.closest('#appMenuOverlay')) {
      if (t.id !== 'menuParticipationToggle' && state._hostKnown && !state.isHost) {
        const before = t.checked;
        queueMicrotask(() => {
          t.checked = !before;
          t.setAttribute('aria-checked', String(t.checked));
          const row = t.closest('.menu-item.switch');
          if (row) row.classList.add('disabled');
        });
        e.preventDefault?.();
        e.stopPropagation?.();
        return;
      }
    }

    // sequence radios
    if (t.type === 'radio' && t.name === 'menu-seq') {
      const id = normalizeSeq(t.value);
      if (!id) return;

      if (state._hostKnown && !state.isHost) {
        updateAllSeqRadiosChecked(state.sequenceId || 'fib.scrum');
        e.preventDefault?.();
        return;
      }

      applyLocalSequence(id);
      notifySequence(id);
    }
  }, true); // capture: true


  // Also reconcile on raw input events (covers .check() etc.)
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.type === 'radio' && t.name === 'menu-seq') {
      queueMicrotask(reconcileSeqFromDOM);
    }
  }, true);

  // Observe attribute-level changes to `checked` to catch non-event flips
  (function observeSeqRadiosChecked() {
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === 'checked') {
          const el = m.target;
          if (el instanceof HTMLInputElement && el.name === 'menu-seq') {
            queueMicrotask(reconcileSeqFromDOM);
          }
        } else if (m.type === 'childList' && (m.addedNodes?.length)) {
          for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches?.('input[type="radio"][name="menu-seq"]:checked') ||
                node.querySelector?.('input[type="radio"][name="menu-seq"]:checked')) {
              queueMicrotask(reconcileSeqFromDOM);
            }
          }
        }
      }
    });
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['checked']
    });
  })();

  function wireMenuEvents() {
    // Single, final close-room confirmation
    document.addEventListener('ep:close-room', () => {
      if (!state.isHost) return;
      const msg2 = t('confirm.closeRoom', 'Close this room for everyone?');
      if (confirm(msg2)) send('closeRoom');
    });

        // Programmatic sequence changes (optimistic) — already bound early.
    // Only register here if the early bridge was not bound for any reason.
    if (!window.__epSeqBridgeBound) {
      document.addEventListener('ep:sequence-change', (ev) => {
        const id = normalizeSeq(ev?.detail?.id || ev?.detail?.sequenceId);
        if (!id) return;
        if (state._hostKnown && !state.isHost) return;
        applyLocalSequence(id);
        notifySequence(id);
      });
    }


    document.addEventListener('ep:auto-reveal-toggle', (ev) => {
      if (!state.isHost) return;
      const on = !!(ev && ev.detail && ev.detail.on);
      send(`autoReveal:${on}`);
    });

    document.addEventListener('ep:topic-toggle', (ev) => {
      if (!state.isHost) return;
      const on = !!(ev && ev.detail && ev.detail.on);

      if (!on) state.topicEditing = false;

      // Update local state immediately (no visual lag)
      state.topicVisible = on;

      // Re-render affected UI
      renderTopic();

      // Also mirror status text / toggle in the menu right away
      syncMenuFromState();

      // Tell the server
      send(`topicVisible:${on}`);
    });

    document.addEventListener('ep:participation-toggle', (ev) => {
      const estimating = !!(ev && ev.detail && ev.detail.estimating);

      // Immediate local mirror (prevents UI lag before server echo)
      state.selfSpectator = !estimating;

      const me = state.participants.find(p => p && p.name === state.youName);
      if (me) {
        me.spectator = !estimating;
        me.participating = estimating;
      }

      // Re-render even if "me" is not in the list yet
      renderParticipants();
      renderCards();
      syncMenuFromState();

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

  // Event-delegation (robust, no global capture)
  let _cardGridBound = false;
  let _plistBound = false;

  function bindDelegatedHandlers() {
    // Cards
    const grid = document.querySelector('#cardGrid');
    if (grid && !_cardGridBound) {
      const onPick = (btn) => {
        if (!btn || btn.disabled) return;
        const label = btn.dataset.value || btn.textContent || '';
        if (!label) return;
        if (mySelectedValue() === String(label)) return;
        // Optimistic selection + send
        state._optimisticVote = String(label);
        try { grid.querySelectorAll('button').forEach(b => b.classList.remove('selected')); } catch {}
        btn.classList.add('selected');
        try { send(`vote:${state.youName}:${label}`); } catch {}
      };

      grid.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const btn = e.target && e.target.closest ? e.target.closest('#cardGrid button') : null;
        if (btn) onPick(btn);
      }, { passive: true });

      grid.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('#cardGrid button') : null;
        if (btn) onPick(btn);
      }, { passive: true });

      _cardGridBound = true;
    }

    // Host / Kick
    const list = document.querySelector('#liveParticipantList');
    if (list && !_plistBound) {
      const onAction = (btn) => {
        const action = btn.dataset.action;
        const name = btn.dataset.name || '';
        if (!action || !name) return;

        if (action === 'host') {
          const q = isDe() ? `Host-Rolle an ${name} übertragen?` : `Transfer host role to ${name}?`;
          if (!confirm(q)) return;
          send('makeHost:' + encodeURIComponent(name));
        } else if (action === 'kick') {
          const q = isDe() ? `${name} wirklich entfernen?` : `Remove ${name}?`;
          if (!confirm(q)) return;
          send('kick:' + encodeURIComponent(name));
        }
      };

      list.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const btn = e.target && e.target.closest ? e.target.closest('#liveParticipantList button.row-action') : null;
        if (btn) { e.preventDefault?.(); onAction(btn); }
      }, { passive: false });

      list.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('#liveParticipantList button.row-action') : null;
        if (btn) onAction(btn);
      }, { passive: false });

      _plistBound = true;
    }

    // Topic row: Save / Cancel (works across DOM swaps)
    const topic = document.querySelector('#topicRow');
    if (topic && !_topicBound) {
      const actions = topic.querySelector('.topic-actions') || topic;

      const doSave = () => {
        if (!state.isHost) return;
        const input = topic.querySelector('#topicDisplay');
        if (!input || input.tagName !== 'INPUT') return;
        const val = input.value || '';
        const parsed = clientParseTopic(val);
        state.topicLabel = parsed.label;
        state.topicUrl = parsed.url;
        state.topicEditing = false;
        renderTopic();
        try { send('topicSave:' + encodeURIComponent(val)); } catch {}
      };

      const doCancel = () => {
        if (!state.isHost) return;
        state.topicEditing = false;
        renderTopic();
      };

      actions.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const btn = e.target && e.target.closest ? e.target.closest('#topicSaveBtn, #topicCancelEditBtn') : null;
        if (!btn) return;
        e.preventDefault?.();
        if (btn.id === 'topicSaveBtn') doSave();
        else doCancel();
      }, { passive: false });

      actions.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('#topicSaveBtn, #topicCancelEditBtn') : null;
        if (!btn) return;
        if (btn.id === 'topicSaveBtn') doSave();
        else doCancel();
      }, { passive: false });

      _topicBound = true;
    }
  }

  function wireOnce() {
    bindCopyLink();
    wireMenuEvents();
    wireSequenceRadios();
    wireMenuTogglesDom();
    bindDelegatedHandlers();

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

    // Lifecycle wake-ups
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wake('visibility');
    }, true);
    window.addEventListener('focus',  () => wake('focus'),  true);
    window.addEventListener('online', () => wake('online'), true);
    window.addEventListener('pageshow', () => { wake('pageshow'); }, true);

    startWatchdog();

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
    let isReloadLike = false;
    try {
      const nav = performance?.getEntriesByType?.('navigation')?.[0];
      if (nav && (nav.type === 'reload' || nav.type === 'back_forward')) isReloadLike = true;
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
    } catch { /* be permissive */ }
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
    ensureBootstrapDeck();     // make cards available immediately on first paint
    seedSelfPlaceholder();
    try {
      if (!document.documentElement.hasAttribute('data-ready')) {
        document.documentElement.setAttribute('data-ready', '1');
      }
    } catch {}

    renderCards();             // allow immediate voting before first server sync
    wireOnce();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
