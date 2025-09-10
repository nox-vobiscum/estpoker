/* room.js v45 — i18n + presence toasts + away icon + small UI fixes
   - Alle UI-Meldungen via i18n (meta[name="msg.KEY"] → content), mit DE/EN Fallbacks.
   - 💤-Icon für "away" (Grace-Phase) aus Server-Feld m.participants[].away.
   - Korrekte Toasts: participantLeft, participantRenamed, hostTransferred (manuell/auto).
   - Fix: Punkt • zwischen Average und Median wird korrekt ein-/ausgeblendet.
*/
(() => {
  'use strict';
  const TAG = '[ROOM]';
  const $  = (s) => document.querySelector(s);
  const setText = (sel, v) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = v ?? ''; };

  // ---------------- i18n helper ----------------
  const LOCALE = (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

  // Read translated string from <meta name="msg.KEY" content="..."> (preferred)
  function msgFromMeta(key) {
    try {
      const m = document.querySelector(`meta[name="msg.${CSS.escape(key)}"]`);
      return m ? m.getAttribute('content') : null;
    } catch { return null; }
  }
  // Tiny template replace: "Hello {name}" ← { name: "Roland" }
  function fmt(str, params) {
    if (!params) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`));
  }
  // Minimal fallback dictionary for keys used in JS
  const FALLBACK = {
    en: {
      'toast.participantLeft': '{name} left the room',
      'toast.participantRenamed': '{from} is now {to}',
      'toast.hostTransferred.to': 'Host role transferred to {to}',
      'toast.hostTransferred.fromTo': 'Host role was transferred from {from} to {to}',
      'copy.ok': 'Link copied',
      'copy.fail': 'Copy failed',
      'reveal.gate': 'Reveal only after everyone voted.',
      'confirm.clear': 'Clear the field?',
      'confirm.closeRoom': 'Close this room for everyone?',
      'confirm.makeHost': 'Transfer host role to {name}?',
      'confirm.kick': 'Remove {name}?',
      'menu.on': 'On',
      'menu.off': 'Off',
      'menu.imEstimating': "I'm estimating",
      'menu.observer': 'Observer'
    },
    de: {
      'toast.participantLeft': '{name} hat den Raum verlassen',
      'toast.participantRenamed': '{from} heißt jetzt {to}',
      'toast.hostTransferred.to': 'Host-Rolle wurde an {to} übertragen',
      'toast.hostTransferred.fromTo': 'Host-Rolle wurde von {from} an {to} übertragen',
      'copy.ok': 'Link kopiert',
      'copy.fail': 'Kopieren fehlgeschlagen',
      'reveal.gate': 'Erst aufdecken, wenn alle gewählt haben.',
      'confirm.clear': 'Feld wirklich leeren?',
      'confirm.closeRoom': 'Diesen Raum für alle schließen?',
      'confirm.makeHost': 'Host-Rolle an {name} übertragen?',
      'confirm.kick': '{name} wirklich entfernen?',
      'menu.on': 'An',
      'menu.off': 'Aus',
      'menu.imEstimating': 'Ich schätze mit',
      'menu.observer': 'Beobachter:in'
    }
  };
  function t(key, params) {
    const fromMeta = msgFromMeta(key);
    const raw = fromMeta != null ? fromMeta : (FALLBACK[LOCALE][key] ?? key);
    return fmt(raw, params);
  }

  // ---------------- constants / state ----------------
  const SPECIALS  = ['❓','💬','☕'];
  const INFINITY_ = '∞';
  const IDLE_MS_THRESHOLD = 900_000; // 15 minutes

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
    _hostKnown: false,
    votesRevealed: false,
    cards: [],
    participants: [],
    averageVote: null,

    sequenceId: null,
    topicVisible: true,
    topicLabel: '',
    topicUrl: null,

    autoRevealEnabled: false,

    // client-only toggles
    hardMode: false,
    allowSpecials: true,

    topicEditing: false,

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
  } catch { state.cid = 'cid-' + Date.now(); }

  setText('#youName', state.youName);
  setText('#roomCodeVal', state.roomCode);

  // Canonicalize URL without reload
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

  // ---------------- helpers ----------------
  function normalizeSeq(id) {
    if (!id) return 'fib.scrum';
    const s = String(id).toLowerCase().trim();
    if (s === 'fib-enh')  return 'fib.enh';
    if (s === 'fib-math') return 'fib.math';
    if (s === 't-shirt')  return 'tshirt';
    return s;
  }

  const wsUrl = () => {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return `${proto}${location.host}/gameSocket` +
      `?roomCode=${encodeURIComponent(state.roomCode)}` +
      `&participantName=${encodeURIComponent(state.youName)}` +
      `&cid=${encodeURIComponent(state.cid)}`;
  };

  function syncHostClass(){ document.body.classList.toggle('is-host', !!state.isHost); }

  // ---------------- websocket ----------------
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
      if (ev.code === 4000 || ev.code === 4001) return; // intentional server close
      setTimeout(() => { if (!state.connected) connectWS(); }, 2000);
    };
    s.onerror = (e) => console.warn(TAG, 'ERROR', e);
    s.onmessage = (ev) => { try { handleMessage(JSON.parse(ev.data)); } catch {} };
  }
  function send(line){ if (state.ws && state.ws.readyState === 1) state.ws.send(line); }

  // heartbeat
  let hbT = null;
  function heartbeat(){ stopHeartbeat(); hbT = setInterval(() => send('ping'), 25_000); }
  function stopHeartbeat(){ if (hbT) { clearInterval(hbT); hbT = null; } }

  // ---------------- messages ----------------
  function handleMessage(m) {
    switch (m.type) {
      case 'you': {
        if (m.yourName && m.yourName !== state.youName) { state.youName = m.yourName; setText('#youName', state.youName); }
        if (m.cid && m.cid !== state.cid) { state.cid = m.cid; try { sessionStorage.setItem(CIDKEY, state.cid); } catch {} }
        break;
      }
      case 'roomClosed': { state.hardRedirect = m.redirect || '/'; try { state.ws && state.ws.close(4000, 'Room closed'); } catch {} break; }
      case 'kicked':     { state.hardRedirect = m.redirect || '/'; try { state.ws && state.ws.close(4001, 'Kicked'); }      catch {} break; }

      case 'participantLeft': {
        if (m.name) showToast(t('toast.participantLeft', { name: m.name }));
        break;
      }
      case 'participantRenamed': {
        if (m.from && m.to) showToast(t('toast.participantRenamed', { from: m.from, to: m.to }));
        break;
      }
      case 'hostTransferred': {
        const from = m.from || '';
        const to   = m.to   || '';
        const msg  = (from && to)
          ? t('toast.hostTransferred.fromTo', { from, to })
          : t('toast.hostTransferred.to', { to });
        showToast(msg);
        break;
      }

      case 'voteUpdate': {
        const seqId = normalizeSeq(m.sequenceId || state.sequenceId || 'fib.scrum');
        const specials = (Array.isArray(m.specials) && m.specials.length) ? m.specials.slice() : SPECIALS.slice();
        let base = Array.isArray(m.cards) ? m.cards.slice() : [];
        base = base.filter(c => !specials.includes(c));
        if (seqId !== 'fib.enh') base = base.filter(c => c !== INFINITY_);
        state.cards = base.concat(specials);

        state.votesRevealed = !!m.votesRevealed;
        state.averageVote   = m.averageVote ?? null;

        const raw = Array.isArray(m.participants) ? m.participants : [];
        // Map "participating === false" to observer, and pass through "away"
        state.participants = raw.map(p => ({
          ...p,
          observer: p.participating === false,
          away: p.away === true
        }));

        if (Object.prototype.hasOwnProperty.call(m, 'topicVisible')) state.topicVisible = !!m.topicVisible;
        state.topicLabel = Object.prototype.hasOwnProperty.call(m, 'topicLabel') ? (m.topicLabel || '') : state.topicLabel;
        state.topicUrl   = Object.prototype.hasOwnProperty.call(m, 'topicUrl')   ? (m.topicUrl || null) : state.topicUrl;
        state.autoRevealEnabled = !!m.autoRevealEnabled;

        state.sequenceId = seqId;

        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);
        state._hostKnown = true;
        if (!state.isHost) state.topicEditing = false;

        if (me && me.vote != null) state._optimisticVote = null;

        syncHostClass();
        renderParticipants();
        renderCards();
        renderResultBar(m);
        renderTopic();
        renderAutoReveal();

        requestAnimationFrame(() => { syncMenuFromState(); syncSequenceInMenu(); });

        if (!document.documentElement.hasAttribute('data-ready')) {
          document.documentElement.setAttribute('data-ready','1');
        }
        break;
      }

      default: break;
    }
  }

  // ---------------- participants ----------------
  function isIdle(p) {
    if (!p || p.disconnected) return false;
    if (p.away === true) return true; // NEW: grace away → 💤
    if (typeof p.idleMs === 'number') return p.idleMs >= IDLE_MS_THRESHOLD;
    if (p.inactive === true || p.away === true) return true;
    return false;
  }

  function renderParticipants() {
    const ul = $('#liveParticipantList'); if (!ul) return;
    ul.innerHTML = '';

    const outlierVals = computeOutlierValues();

    state.participants.forEach(p => {
      const li = document.createElement('li');
      li.className = 'participant-row';
      if (p.disconnected) li.classList.add('disconnected');
      if (p.isHost) li.classList.add('is-host');

      const awayNow = isIdle(p);

      const left = document.createElement('span');
      left.className = 'participant-icon' + (p.isHost ? ' host' : '');
      left.textContent = p.isHost ? '👑' : (awayNow ? '💤' : '👤');
      li.appendChild(left);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      li.appendChild(name);

      const right = document.createElement('div');
      right.className = 'row-right';

      if (!state.votesRevealed) {
        if (p.observer) {
          const eye = document.createElement('span'); eye.className = 'status-icon observer'; eye.textContent = '👁'; right.appendChild(eye);
        } else if (awayNow) {
          // waiting zzz indicator (even for host)
          const z = document.createElement('span'); z.className = 'status-icon pending'; z.textContent = '💤'; right.appendChild(z);
        } else if (!p.disconnected && p.vote != null) {
          const done = document.createElement('span'); done.className = 'status-icon done'; done.textContent = '✓'; right.appendChild(done);
        } else if (!p.disconnected) {
          const wait = document.createElement('span'); wait.className = 'status-icon pending'; wait.textContent = '⏳'; right.appendChild(wait);
        }
      } else {
        if (p.observer) {
          const eye = document.createElement('span'); eye.className = 'status-icon observer'; eye.textContent = '👁'; right.appendChild(eye);
        } else {
          const chip = document.createElement('span');
          chip.className = 'vote-chip';
          const display = (p.vote == null || p.vote === '') ? '–' : String(p.vote);
          chip.textContent = display;

          const isEmpty   = (display === '–' || display === '-');
          const isSpecial = (display === '☕' || display === '❓' || display === '💬' || display === INFINITY_);
          const nonNumeric = isEmpty || isSpecial || p.disconnected || p.participating === false;
          if (nonNumeric) {
            chip.classList.add('special');
          } else {
            const vNum = toNumeric(display);
            if (vNum != null && outlierVals.has(vNum)) chip.classList.add('outlier');
          }
          right.appendChild(chip);
        }
      }

      // host-only row actions
      if (state.isHost && !p.isHost) {
        const makeHostBtn = document.createElement('button');
        makeHostBtn.className = 'row-action host';
        makeHostBtn.type = 'button';
        const titleHost = t('confirm.makeHost', { name: p.name });
        makeHostBtn.setAttribute('aria-label', titleHost);
        makeHostBtn.setAttribute('title', titleHost);
        makeHostBtn.innerHTML = '<span class="ra-icon">👑</span><span class="ra-label"></span>';
        makeHostBtn.addEventListener('click', () => {
          if (confirm(t('confirm.makeHost', { name: p.name }))) send('makeHost:' + encodeURIComponent(p.name));
        });
        right.appendChild(makeHostBtn);

        const kickBtn = document.createElement('button');
        kickBtn.className = 'row-action kick';
        kickBtn.type = 'button';
        const titleKick = t('confirm.kick', { name: p.name });
        kickBtn.setAttribute('aria-label', titleKick);
        kickBtn.setAttribute('title', titleKick);
        kickBtn.innerHTML = '<span class="ra-icon">❌</span><span class="ra-label"></span>';
        kickBtn.addEventListener('click', () => {
          if (confirm(t('confirm.kick', { name: p.name }))) send('kick:' + encodeURIComponent(p.name));
        });
        right.appendChild(kickBtn);
      }

      li.appendChild(right);
      ul.appendChild(li);
    });
  }

  // ---------------- cards ----------------
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

    const specialsAll = state.cards.filter(v => SPECIALS.includes(v));
    const numbers     = state.cards.filter(v => !SPECIALS.includes(v));
    const specials    = state.allowSpecials ? specialsAll : [];

    const selectedVal = mySelectedValue();

    function addCardButton(val) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const label = String(val);
      btn.textContent = label;
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
      const br = document.createElement('div'); br.className = 'grid-break'; br.setAttribute('aria-hidden','true'); grid.appendChild(br);
      specials.forEach(addCardButton);
    }

    const revealBtn = $('#revealButton');
    const resetBtn  = $('#resetButton');

    const hardGateOK = !state.hardMode || allEligibleVoted();

    const showReveal = (!state.votesRevealed && state.isHost);
    const showReset  = ( state.votesRevealed && state.isHost);

    if (revealBtn) {
      revealBtn.style.display = showReveal ? '' : 'none';
      revealBtn.hidden = !showReveal;
      revealBtn.disabled = !hardGateOK;
      if (!hardGateOK) {
        revealBtn.setAttribute('title', t('reveal.gate'));
        revealBtn.setAttribute('aria-disabled', 'true');
      } else {
        revealBtn.removeAttribute('title');
        revealBtn.removeAttribute('aria-disabled');
      }
    }
    if (resetBtn) {
      resetBtn.style.display  = showReset ? '' : 'none';
      resetBtn.hidden = !showReset;
    }
  }

  // ---------------- result bar ----------------
  function renderResultBar(m) {
    const avgEl = $('#averageVote');
    if (avgEl) {
      avgEl.textContent = (state.averageVote != null) ? String(state.averageVote) : 'N/A';
    }

    const pre  = document.querySelector('.pre-vote');
    const post = document.querySelector('.post-vote');
    if (pre && post) { pre.style.display  = state.votesRevealed ? 'none' : ''; post.style.display = state.votesRevealed ? '' : 'none'; }

    const medianWrap = $('#medianWrap');
    const rangeWrap  = $('#rangeWrap');
    const rangeSep   = $('#rangeSep');

    const row = $('#resultRow');
    const avgWrap = document.querySelector('#resultLabel .label-average');
    const consEl  = document.querySelector('#resultLabel .label-consensus');

    // the first separator between Average and the next stat
    const firstSep = document.querySelector('#resultRow .sep');

    if (row) {
      if (m && m.consensus) {
        row.classList.add('consensus');
        if (avgWrap) avgWrap.hidden = true;
        if (consEl) { consEl.hidden = false; consEl.textContent = t('label.consensus'); }
        if (firstSep) firstSep.hidden = true;
        if (medianWrap) medianWrap.hidden = true;
        if (rangeSep)  rangeSep.hidden  = true;
        if (rangeWrap) rangeWrap.hidden = true;
      } else {
        row.classList.remove('consensus');
        if (avgWrap) avgWrap.hidden = false;
        if (consEl)  consEl.hidden  = true;
        if (firstSep) firstSep.hidden = false; // ensure dot is visible again
      }
    }

    if (!(m && m.consensus)) {
      if (medianWrap) {
        const show = m && m.medianVote != null;
        medianWrap.hidden = !show;
        if (show) setText('#medianVote', m.medianVote);
      }
      if (rangeWrap && rangeSep) {
        const show = m && m.range != null;
        rangeWrap.hidden = !show;
        rangeSep.hidden  = !show;
        if (show) setText('#rangeVote', m.range);
      }
    }
  }

  // ---------------- topic row ----------------
  function ensureTopicDialog(){
    let dlg = document.querySelector('dialog.ep-topic-dialog');
    if (dlg) return dlg;

    dlg = document.createElement('dialog');
    dlg.className = 'ep-topic-dialog';
    dlg.setAttribute('style',
      'padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text);' +
      'width:min(92vw,480px);max-width:95vw;box-shadow:0 20px 40px rgba(0,0,0,.35)'
    );

    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateRows = 'auto auto';
    wrap.style.gap = '10px';

    const title = document.createElement('div');
    title.textContent = '📝';
    title.setAttribute('aria-hidden','true');
    title.style.fontSize = '20px';

    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = t('topic.input.placeholder');
    input.value = '';
    input.setAttribute('style',
      'height:44px;padding:0 .75rem;border-radius:10px;border:1px solid var(--field-border, var(--border));' +
      'background:var(--field-bg, var(--panel));color:var(--field-fg, var(--text));'
    );
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); }});

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';

    const mkBtn = (labelEmoji, aria, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = labelEmoji;
      b.setAttribute('aria-label', aria);
      b.style.height = '36px';
      b.style.width  = '44px';
      b.style.borderRadius = '10px';
      b.style.border = '1px solid var(--border)';
      b.style.background = 'var(--panel-2)';
      b.style.color = 'var(--text)';
      b.style.cursor = 'pointer';
      b.addEventListener('click', onClick);
      return b;
    };

    const doSave = () => {
      const val = input.value || '';
      send('topicSave:' + encodeURIComponent(val));
      try { dlg.close(); } catch {}
    };
    const doClear = () => {
      if (!confirm(t('confirm.clear'))) return;
      send('topicSave:' + encodeURIComponent(''));
      try { dlg.close(); } catch {}
    };
    const doCancel = () => { try { dlg.close(); } catch {} };

    const saveBtn   = mkBtn('💾', t('button.saveTopic'), doSave);
    const clearBtn  = mkBtn('🧹', t('button.clearTopic'), doClear);
    const cancelBtn = mkBtn('✖',  t('button.cancel'),    doCancel);

    actions.appendChild(saveBtn);
    actions.appendChild(clearBtn);
    actions.appendChild(cancelBtn);

    wrap.appendChild(title);
    wrap.appendChild(input);
    wrap.appendChild(actions);
    dlg.appendChild(wrap);

    document.body.appendChild(dlg);

    dlg._input = input;
    return dlg;
  }

  function overlay(){ return $('#topicEdit'); }
  function overlayInput(){ return $('#topicInput') || (overlay() ? overlay().querySelector('input[type="text"]') : null); }
  function showOverlay(){
    const box = overlay();
    if (box) { box.hidden = false; box.style.display = ''; }
    const inp = overlayInput();
    if (inp) { inp.value = state.topicLabel || ''; setTimeout(() => { try { inp.focus(); } catch {} }, 0); }
  }
  function hideOverlay(){
    const box = overlay();
    if (box) { box.hidden = true; box.style.display = 'none'; }
  }

  window.topicBeginEdit = function(){ if (!state.isHost) return; if (overlay()) showOverlay(); else { const dlg = ensureTopicDialog(); dlg._input.value = state.topicLabel || ''; if (typeof dlg.showModal === 'function') dlg.showModal(); } };
  window.topicSave      = function(){ if (!state.isHost) return; const val = (overlayInput() && overlayInput().value) || ''; send('topicSave:' + encodeURIComponent(val)); state.topicEditing = false; hideOverlay(); };
  window.topicClear     = function(){ if (!state.isHost) return; if (!confirm(t('confirm.clear'))) return; send('topicSave:' + encodeURIComponent('')); state.topicLabel = ''; state.topicUrl = null; state.topicVisible = true; state.topicEditing = false; hideOverlay(); renderTopic(); syncMenuFromState(); };
  window.topicCancel    = function(){ hideOverlay(); state.topicEditing = false; };

  function renderTopic() {
    const row  = $('#topicRow');
    const disp = $('#topicDisplay');
    if (!row || !disp) return;

    if (state.topicLabel && state.topicUrl) {
      disp.innerHTML = `<a href="${encodeURI(state.topicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.topicLabel)}</a>`;
    } else if (state.topicLabel) {
      disp.textContent = state.topicLabel;
    } else {
      disp.textContent = '–';
    }

    row.style.display = state.topicVisible ? '' : 'none';
    if (!state.topicEditing) hideOverlay();
  }

  // ---------------- auto-reveal indicator ----------------
  function renderAutoReveal() {
    const preSt  = document.querySelector('.pre-vote #arStatus');
    const menuSt = document.querySelector('#appMenuOverlay #menuArStatus');
    const statusText = state.autoRevealEnabled ? t('menu.on') : t('menu.off');
    if (preSt)  preSt.textContent = statusText;
    if (menuSt) menuSt.textContent = statusText;
  }

  // ---------------- menu sync ----------------
  function setRowDisabled(inputId, disabled){
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

    const mTgl = $('#menuTopicToggle'); const mSt  = $('#menuTopicStatus');
    if (mTgl) { mTgl.checked = !!state.topicVisible; mTgl.setAttribute('aria-checked', String(!!state.topicVisible)); }
    if (mSt) mSt.textContent = state.topicVisible ? t('menu.on') : t('menu.off');

    const me = state.participants.find(p => p.name === state.youName);
    const isObserver = !!(me && me.observer);
    const mPTgl = $('#menuParticipationToggle'); const mPSt  = $('#menuPartStatus');
    if (mPTgl) { mPTgl.checked = !isObserver; mPTgl.setAttribute('aria-checked', String(!isObserver)); }
    if (mPSt) mPSt.textContent = !isObserver ? t('menu.imEstimating') : t('menu.observer');

    const mARTgl = $('#menuAutoRevealToggle');
    if (mARTgl) { mARTgl.checked = !!state.autoRevealEnabled; mARTgl.setAttribute('aria-checked', String(!!state.autoRevealEnabled)); }

    const mSPTgl = $('#menuSpecialsToggle'); const mSPSt = $('#menuSpecialsStatus');
    if (mSPTgl) { mSPTgl.checked = !!state.allowSpecials; mSPTgl.setAttribute('aria-checked', String(!!state.allowSpecials)); }
    if (mSPSt)  mSPSt.textContent = state.allowSpecials ? t('menu.on') : t('menu.off');

    const mHRTgl = $('#menuHardModeToggle'); const mHRSt = $('#menuHardStatus');
    if (mHRTgl) { mHRTgl.checked = !!state.hardMode; mHRTgl.setAttribute('aria-checked', String(!!state.hardMode)); }
    if (mHRSt)  mHRSt.textContent = state.hardMode ? t('menu.on') : t('menu.off');
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

    const id = state.sequenceId || '';
    const sel = root.querySelector(`input[type="radio"][name="menu-seq"][value="${CSS.escape(id)}"]`)
             || root.querySelector(`input[type="radio"][name="menu-seq"][value="${CSS.escape(id.replace('.', '-'))}"]`);
    if (sel) { sel.checked = true; sel.setAttribute('aria-checked','true'); }
  }

  document.addEventListener('ep:menu-open', () => { syncMenuFromState(); syncSequenceInMenu(); });

  // ---------------- global actions ----------------
  function revealCards(){
    if (state.hardMode && !allEligibleVoted()) {
      showToast(t('reveal.gate'));
      return;
    }
    send('revealCards');
  }
  function resetRoom(){  send('resetRoom'); }
  window.revealCards = revealCards;
  window.resetRoom   = resetRoom;

  // ---------- Outlier helpers ----------
  function toNumeric(v){
    if (v == null) return null;
    const s = String(v).trim();
    if (s === '' || s === INFINITY_ || SPECIALS.includes(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function computeOutlierValues(){
    if (!state.votesRevealed) return new Set();

    const nums = [];
    for (const p of state.participants) {
      if (!p || p.observer || p.disconnected) continue;
      const n = toNumeric(p.vote);
      if (n != null) nums.push(n);
    }
    if (nums.length < 3) return new Set();

    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 1e-9) return new Set();

    const avgNum = toNumeric(state.averageVote);
    if (avgNum == null) return new Set();

    const diffs = nums.map(n => Math.abs(n - avgNum));
    const maxDev = Math.max(...diffs);
    const EPS = 1e-6;
    if (maxDev <= EPS) return new Set();

    const out = new Set();
    nums.forEach((n, i) => { if (Math.abs(diffs[i] - maxDev) <= EPS) out.add(n); });
    return out;
  }

  // ---------- Feedback / copy helpers ----------
  function showToast(msg, ms = 2600) {
    try {
      const tdiv = document.createElement('div');
      tdiv.className = 'toast';
      tdiv.textContent = msg;
      document.body.appendChild(tdiv);
      // force reflow for CSS animation
      // eslint-disable-next-line no-unused-expressions
      tdiv.offsetHeight;
      setTimeout(() => tdiv.remove(), ms + 600);
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

    async function handle() {
      const ok = await copyText(inviteUrl());
      const prev = btn.getAttribute('title');
      btn.setAttribute('title', ok ? t('copy.ok') : t('copy.fail'));
      showToast(ok ? t('copy.ok') : t('copy.fail'));
      if (prev != null) setTimeout(() => btn.setAttribute('title', prev), 2200);
      else setTimeout(() => btn.removeAttribute('title'), 2200);
    }
    btn.addEventListener('click', (e) => { e.preventDefault(); handle(); });
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(); } });
  }

  // ---------------- wire UI once ----------------
  function wireOnce() {
    bindCopyLink();

    // Topic edit buttons / row
    const row      = $('#topicRow');
    const editBtn  = $('#topicEditBtn');
    const clearBtn = $('#topicClearBtn');

    function beginTopicEdit(){
      if (!state.isHost) return;
      if (overlay()) {
        showOverlay();
      } else {
        const dlg = ensureTopicDialog();
        dlg._input.value = state.topicLabel || '';
        if (typeof dlg.showModal === 'function') dlg.showModal();
        else {
          const v = prompt(t('topic.input.placeholder'), state.topicLabel || '');
          if (v !== null) send('topicSave:' + encodeURIComponent(v));
        }
      }
    }

    if (row) {
      row.addEventListener('click', (e) => {
        if (!state.isHost || state.topicLabel || state.topicEditing) return;
        if (e.target.closest('button,a,input')) return;
        beginTopicEdit();
      });
    }
    if (editBtn) editBtn.addEventListener('click', beginTopicEdit);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!state.isHost) return;
        if (!confirm(t('confirm.clear'))) return;
        send('topicSave:' + encodeURIComponent(''));
        state.topicLabel = ''; state.topicUrl = null; state.topicVisible = true;
        state.topicEditing = false;
        hideOverlay();
        renderTopic(); syncMenuFromState();
      });
    }

    // auto-reveal toggle (pre-vote panel)
    const arToggle = $('#autoRevealToggle');
    if (arToggle) {
      arToggle.addEventListener('change', (e) => {
        if (!state.isHost) return;
        const on = !!e.target.checked;
        send(`autoReveal:${on}`);
      });
    }

    // menu custom events
    document.addEventListener('ep:close-room', () => {
      if (!state.isHost) return;
      if (confirm(t('confirm.closeRoom'))) send('closeRoom');
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

    // specials & hard mode (client-only, host preference)
    document.addEventListener('ep:specials-toggle', (ev) => {
      if (!state.isHost) return;
      const on = !!(ev && ev.detail && ev.detail.on);
      state.allowSpecials = on;
      syncMenuFromState();
      renderCards();
    });
    document.addEventListener('ep:hard-mode-toggle', (ev) => {
      if (!state.isHost) return;
      const on = !!(ev && ev.detail && ev.detail.on);
      state.hardMode = on;
      syncMenuFromState();
      renderCards();
    });

    window.addEventListener('beforeunload', () => { try { send('intentionalLeave'); } catch {} });

    window.addEventListener('pageshow', () => {
      document.dispatchEvent(new CustomEvent('ep:request-sync', { detail: { room: state.roomCode } }));
      if (!state.connected && (!state.ws || state.ws.readyState !== 1)) connectWS();
    });

    syncSequenceInMenu();
  }

  // ---------------- helpers ----------------
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function boot(){ wireOnce(); syncHostClass(); connectWS(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // --- end ---
})();
