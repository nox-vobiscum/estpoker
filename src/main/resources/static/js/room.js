/* room.js v43 — compat + fixes
   - Restore legacy #topicEdit overlay API (topicBeginEdit/topicSave/topicClear/topicCancel) for tests.
   - Ensure sequence radios re-sync enabled/disabled on menu open (host vs guest).
   - Keep inline/mobile editor as progressive enhancement; overlay preferred when present.
   - Auto-reveal/menu toggles kept; card deck & ∞ visibility follow current sequence.
*/
(() => {
  'use strict';
  const TAG = '[ROOM]';
  const $  = (s) => document.querySelector(s);
  const setText = (sel, v) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = v ?? ''; };

  // --- constants -------------------------------------------------------------
  const SPECIALS  = ['❓','💬','☕'];
  const INFINITY_ = '∞';
  const IDLE_MS_THRESHOLD = 900_000; // 15 minutes

  // script dataset / URL params
  const scriptEl = document.querySelector('script[src*="/js/room.js"]');
  const ds = (scriptEl && scriptEl.dataset) || {};
  const url = new URL(location.href);

  // app state (client-only)
  const state = {
    roomCode: ds.room || url.searchParams.get('roomCode') || 'demo',
    youName:  ds.participant || url.searchParams.get('participantName') || 'Guest',
    cid: null,
    ws: null,
    connected: false,

    isHost: false,
    _hostKnown: false, // set true after first voteUpdate handling
    votesRevealed: false,
    cards: [],
    participants: [],
    averageVote: null,

    sequenceId: null,
    topicVisible: true,
    topicLabel: '',
    topicUrl: null,

    autoRevealEnabled: false,

    // Client-only toggles
    hardMode: false,
    allowSpecials: true,

    // Topic edit state (inline mode)
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
  } catch { state.cid = 'cid-' + Date.now(); }

  setText('#youName', state.youName);
  setText('#roomCodeVal', state.roomCode);

  // — Canonicalize current URL (uniform param order, no reload)
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

  // --- small helpers (client-side normalizations) ---------------------------
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

  // --- websocket -------------------------------------------------------------
  function connectWS() {
    const u = wsUrl();
    console.info(TAG, 'connect →', u);
    let s;
    try { s = new WebSocket(u); } catch (e) { console.error(TAG, e); return; }
    state.ws = s;

    s.onopen = () => {
      state.connected = true;
      // Assert your display name on (re)connect so server can enforce uniqueness per room.
      try { send('rename:' + encodeURIComponent(state.youName)); } catch {}
      heartbeat();
    };
    s.onclose = (ev) => {
      state.connected = false; stopHeartbeat();
      if (state.hardRedirect) { location.href = state.hardRedirect; return; }
      if (ev.code === 4000 || ev.code === 4001) return; // intentional
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

  function syncHostClass(){ document.body.classList.toggle('is-host', !!state.isHost); }

  // --- message handling ------------------------------------------------------
  function handleMessage(m) {
    switch (m.type) {
      case 'you': {
        if (m.yourName && m.yourName !== state.youName) { state.youName = m.yourName; setText('#youName', state.youName); }
        if (m.cid && m.cid !== state.cid) { state.cid = m.cid; try { sessionStorage.setItem(CIDKEY, state.cid); } catch {} }
        break;
      }
      case 'roomClosed': { state.hardRedirect = m.redirect || '/'; try { state.ws && state.ws.close(4000, 'Room closed'); } catch {} break; }
      case 'kicked':     { state.hardRedirect = m.redirect || '/'; try { state.ws && state.ws.close(4001, 'Kicked'); }      catch {} break; }

      case 'voteUpdate': {
        // cards & sequence
        const seqId = normalizeSeq(m.sequenceId || state.sequenceId || 'fib.scrum');
        const specials = (Array.isArray(m.specials) && m.specials.length) ? m.specials.slice() : SPECIALS.slice();
        let base = Array.isArray(m.cards) ? m.cards.slice() : [];
        base = base.filter(c => !specials.includes(c));
        if (seqId !== 'fib.enh') base = base.filter(c => c !== INFINITY_);
        state.cards = base.concat(specials);

        // flags
        state.votesRevealed = !!m.votesRevealed;
        state.averageVote   = m.averageVote ?? null;

        // participants (normalize observer flag)
        const raw = Array.isArray(m.participants) ? m.participants : [];
        state.participants = raw.map(p => ({ ...p, observer: p.participating === false }));

        // topic & auto-reveal
        if (Object.prototype.hasOwnProperty.call(m, 'topicVisible')) state.topicVisible = !!m.topicVisible;
        state.topicLabel = Object.prototype.hasOwnProperty.call(m, 'topicLabel') ? (m.topicLabel || '') : state.topicLabel;
        state.topicUrl   = Object.prototype.hasOwnProperty.call(m, 'topicUrl')   ? (m.topicUrl || null) : state.topicUrl;
        state.autoRevealEnabled = !!m.autoRevealEnabled;

        // sequence persisted
        state.sequenceId = seqId;

        // host?
        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);
        state._hostKnown = true;
        if (!state.isHost) {
          state.topicEditing = false;
        } else {
          state.topicEditing = false;
        }

        // clear optimistic selection when server confirms our vote
        if (me && me.vote != null) state._optimisticVote = null;

        syncHostClass();
        renderParticipants();
        renderCards();
        renderResultBar(m);
        renderTopic();
        renderAutoReveal();
        // Ensure menu reflects most recent state even if opened just now
        requestAnimationFrame(() => { syncMenuFromState(); syncSequenceInMenu(); });

        if (!document.documentElement.hasAttribute('data-ready')) {
          document.documentElement.setAttribute('data-ready','1');
        }
        break;
      }

      case 'hostTransferred': {
        const n = (x)=> (x==null?'':String(x));
        const de = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
        const msg = m.youAreHost
          ? (de ? `${n(m.from)} hat den Raum verlassen, Du bist jetzt Host`
                : `${n(m.from)} left, you are now Host`)
          : (de ? `${n(m.from)} hat den Raum verlassen, ${n(m.to)} ist jetzt Host`
                : `${n(m.from)} left, ${n(m.to)} is now Host`);
        showToast(msg);
        break;
      }

      default: break;
    }
  }

  // --- participants ----------------------------------------------------------
  function isIdle(p) {
    if (!p || p.disconnected) return false;
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

      const idle = isIdle(p);
      const left = document.createElement('span');
      left.className = 'participant-icon' + (p.isHost ? ' host' : '');
      left.textContent = p.isHost ? '👑' : (idle ? '💤' : '👤');
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
        } else if (idle) {
          if (p.isHost) {
            const z = document.createElement('span'); z.className = 'status-icon pending'; z.textContent = '💤'; right.appendChild(z);
          }
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
        const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');

        const makeHostBtn = document.createElement('button');
        makeHostBtn.className = 'row-action host';
        makeHostBtn.type = 'button';
        const titleHost = isDe ? 'Zum Host machen' : 'Make host';
        makeHostBtn.setAttribute('aria-label', titleHost);
        makeHostBtn.setAttribute('title', titleHost);
        makeHostBtn.innerHTML = '<span class="ra-icon">👑</span><span class="ra-label">Make host</span>';
        makeHostBtn.addEventListener('click', () => {
          const q = isDe ? `Host-Rolle an ${p.name} übergeben?` : `Make ${p.name} the host?`;
          if (confirm(q)) send('makeHost:' + encodeURIComponent(p.name));
        });
        right.appendChild(makeHostBtn);

        const kickBtn = document.createElement('button');
        kickBtn.className = 'row-action kick';
        kickBtn.type = 'button';
        const titleKick = isDe ? 'Teilnehmer entfernen' : 'Kick participant';
        kickBtn.setAttribute('aria-label', titleKick);
        kickBtn.setAttribute('title', titleKick);
        kickBtn.innerHTML = '<span class="ra-icon">❌</span><span class="ra-label">Kick</span>';
        kickBtn.addEventListener('click', () => {
          const q = isDe ? `${p.name} wirklich entfernen?` : `Remove ${p.name}?`;
          if (confirm(q)) send('kick:' + encodeURIComponent(p.name));
        });
        right.appendChild(kickBtn);
      }

      li.appendChild(right);
      ul.appendChild(li);
    });
  }

  // --- cards -----------------------------------------------------------------
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
    // (specials allowed for "done" — server controls auto-reveal validity)
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
      const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
      if (!hardGateOK) {
        revealBtn.setAttribute('title', isDe ? 'Es haben noch nicht alle ihre Schätzung abgegeben' : 'Not everyone has voted yet');
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

  // --- result bar (avg / consensus) -----------------------------------------
  function renderResultBar(m) {
    const eligible = state.participants.filter(p => p && !p.observer && !p.disconnected);
    const submitted = eligible.filter(p => p.vote != null && p.vote !== '');
    const numericCount = submitted.filter(p => toNumeric(p.vote) != null).length;

    const avgEl = $('#averageVote');
    if (avgEl) {
      if (state.averageVote != null) {
        const suffix = submitted.length ? ` (${numericCount}/${submitted.length})` : '';
        avgEl.textContent = String(state.averageVote) + suffix;
      } else {
        avgEl.textContent = 'N/A';
      }
    }

    const pre  = document.querySelector('.pre-vote');
    const post = document.querySelector('.post-vote');
    if (pre && post) { pre.style.display  = state.votesRevealed ? 'none' : ''; post.style.display = state.votesRevealed ? '' : 'none'; }

    const medianWrap = $('#medianWrap');
    const rangeWrap  = $('#rangeWrap');
    const rangeSep   = $('#rangeSep');

    const row = $('#resultRow');
    const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
    const avgWrap = document.querySelector('#resultLabel .label-average');
    const consEl  = document.querySelector('#resultLabel .label-consensus');

    if (row) {
      if (m && m.consensus) {
        row.classList.add('consensus');
        if (avgWrap) avgWrap.hidden = true;
        if (consEl) { consEl.hidden = false; consEl.textContent = isDe ? '🎉 Konsens' : '🎉 Consensus'; }
        const sep1 = document.querySelector('#resultRow .sep'); if (sep1) sep1.hidden = true;
        if (medianWrap) medianWrap.hidden = true;
        if (rangeSep)  rangeSep.hidden  = true;
        if (rangeWrap) rangeWrap.hidden = true;
      } else {
        row.classList.remove('consensus');
        if (avgWrap) avgWrap.hidden = false;
        if (consEl)  consEl.hidden  = true;
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

  // --- topic row (inline + legacy overlay) ----------------------------------
  function isDe(){ return (document.documentElement.lang || 'en').toLowerCase().startsWith('de'); }

  // Mobile-friendly dialog for quick edit (kept as enhancement)
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
    input.placeholder = isDe()
      ? 'Anforderung kurz beschreiben oder JIRA-Link einfügen'
      : 'Briefly describe requirement or paste JIRA link';
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
      const ok = confirm(isDe() ? 'Feld wirklich leeren?' : 'Clear the field?');
      if (!ok) return;
      send('topicSave:' + encodeURIComponent(''));
      try { dlg.close(); } catch {}
    };
    const doCancel = () => { try { dlg.close(); } catch {} };

    const saveBtn   = mkBtn('💾', isDe() ? 'Speichern' : 'Save',   doSave);
    const clearBtn  = mkBtn('🧹', isDe() ? 'Feld leeren' : 'Clear field', doClear);
    const cancelBtn = mkBtn('✖',  isDe() ? 'Abbrechen' : 'Cancel', doCancel);

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

  // Legacy overlay helpers (compat with tests expecting #topicEdit visibility)
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

  // Public (global) legacy API used by markup (and tests click the buttons)
  window.topicBeginEdit = function(){ if (!state.isHost) return; showOverlay(); };
  window.topicSave      = function(){
    if (!state.isHost) return;
    const val = (overlayInput() && overlayInput().value) || '';
    send('topicSave:' + encodeURIComponent(val));
    state.topicEditing = false;
    hideOverlay();
  };
  window.topicClear     = function(){
    if (!state.isHost) return;
    send('topicSave:' + encodeURIComponent(''));
    state.topicLabel = ''; state.topicUrl = null; state.topicVisible = true;
    state.topicEditing = false;
    hideOverlay();
    renderTopic(); syncMenuFromState();
  };
  window.topicCancel    = function(){ hideOverlay(); state.topicEditing = false; };

  function renderTopic() {
    const row  = $('#topicRow');
    const disp = $('#topicDisplay');
    if (!row || !disp) return;

    // display content
    if (state.topicLabel && state.topicUrl) {
      disp.innerHTML = `<a href="${encodeURI(state.topicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.topicLabel)}</a>`;
    } else if (state.topicLabel) {
      disp.textContent = state.topicLabel;
    } else {
      disp.textContent = '–';
    }

    // host-only actions block visibility handled by CSS via .is-host on body
    // row visibility
    row.style.display = state.topicVisible ? '' : 'none';

    // keep overlay hidden when not editing
    if (!state.topicEditing) hideOverlay();
  }

  // --- auto-reveal indicator -------------------------------------------------
  function renderAutoReveal() {
    const preSt  = document.querySelector('.pre-vote #arStatus');
    const menuSt = document.querySelector('#appMenuOverlay #menuArStatus');
    const statusText = state.autoRevealEnabled ? 'On' : 'Off';
    if (preSt)  preSt.textContent = statusText;
    if (menuSt) menuSt.textContent = statusText;
  }

  // --- menu sync (visibility/enabled) ---------------------------------------
  function setRowDisabled(inputId, disabled){
    const input = document.getElementById(inputId);
    const row = input ? input.closest('.menu-item.switch') : null;
    if (input) { input.disabled = !!disabled; input.setAttribute('aria-disabled', String(!!disabled)); }
    if (row) { row.classList.toggle('disabled', !!disabled); }
  }

  function syncMenuFromState() {
    const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');

    setRowDisabled('menuAutoRevealToggle', !state.isHost && state._hostKnown);
    setRowDisabled('menuTopicToggle',      !state.isHost && state._hostKnown);
    setRowDisabled('menuSpecialsToggle',   !state.isHost && state._hostKnown);
    setRowDisabled('menuHardModeToggle',   !state.isHost && state._hostKnown);

    const mTgl = $('#menuTopicToggle'); const mSt  = $('#menuTopicStatus');
    if (mTgl) { mTgl.checked = !!state.topicVisible; mTgl.setAttribute('aria-checked', String(!!state.topicVisible)); }
    if (mSt) mSt.textContent = state.topicVisible ? (isDe ? 'An' : 'On') : (isDe ? 'Aus' : 'Off');

    const me = state.participants.find(p => p.name === state.youName);
    const isObserver = !!(me && me.observer);
    const mPTgl = $('#menuParticipationToggle'); const mPSt  = $('#menuPartStatus');
    if (mPTgl) { mPTgl.checked = !isObserver; mPTgl.setAttribute('aria-checked', String(!isObserver)); }
    if (mPSt) mPSt.textContent = !isObserver ? (isDe ? 'Ich schätze mit' : "I'm estimating") : (isDe ? 'Beobachter:in' : 'Observer');

    const mARTgl = $('#menuAutoRevealToggle');
    if (mARTgl) { mARTgl.checked = !!state.autoRevealEnabled; mARTgl.setAttribute('aria-checked', String(!!state.autoRevealEnabled)); }

    const mSPTgl = $('#menuSpecialsToggle'); const mSPSt = $('#menuSpecialsStatus');
    if (mSPTgl) { mSPTgl.checked = !!state.allowSpecials; mSPTgl.setAttribute('aria-checked', String(!!state.allowSpecials)); }
    if (mSPSt)  mSPSt.textContent = state.allowSpecials ? (isDe ? 'An' : 'On') : (isDe ? 'Aus' : 'Off');

    const mHRTgl = $('#menuHardModeToggle'); const mHRSt = $('#menuHardStatus');
    if (mHRTgl) { mHRTgl.checked = !!state.hardMode; mHRTgl.setAttribute('aria-checked', String(!!state.hardMode)); }
    if (mHRSt)  mHRSt.textContent = state.hardMode ? (isDe ? 'An' : 'On') : (isDe ? 'Aus' : 'Off');
  }

  function syncSequenceInMenu() {
    const root = $('#menuSeqChoice'); if (!root) return;

    // Enable for host, disable for guests; when host-unknown yet, don't force-disable
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

  // Re-sync when the menu opens (fix race in tests)
  document.addEventListener('ep:menu-open', () => { syncMenuFromState(); syncSequenceInMenu(); });

  // --- global actions --------------------------------------------------------
  function revealCards(){
    if (state.hardMode && !allEligibleVoted()) {
      const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
      showToast(isDe ? 'Erst aufdecken, wenn alle gewählt haben.' : 'Reveal only after everyone voted.');
      return;
    }
    send('revealCards');
  }
  function resetRoom(){  send('resetRoom'); }
  window.revealCards = revealCards;
  window.resetRoom   = resetRoom;

  // ---------- Outlier helpers (post-reveal) ----------------------------------
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
    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 1e-9) {
      return new Set();
    }

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

  // ---------- Feedback / copy helpers ---------------------------------------
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

    const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
    const okMsg   = isDe ? 'Link kopiert' : 'Link copied';
    const failMsg = isDe ? 'Kopieren fehlgeschlagen' : 'Copy failed';

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

  // --- wire UI once ----------------------------------------------------------
  function wireOnce() {
    bindCopyLink();

    // Edit button (legacy overlay preferred; inline/dialog fallback)
    {
      const row      = $('#topicRow');
      const editBtn  = $('#topicEditBtn');
      const clearBtn = $('#topicClearBtn');

      function beginTopicEdit(){
        if (!state.isHost) return;
        if (overlay()) {
          showOverlay();
        } else {
          // fallback dialog (mobile) or inline (if present)
          const dlg = ensureTopicDialog();
          dlg._input.value = state.topicLabel || '';
          if (typeof dlg.showModal === 'function') dlg.showModal();
          else {
            const v = prompt(isDe() ? 'Ticket/Topic bearbeiten:' : 'Edit ticket/topic:', state.topicLabel || '');
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
          send('topicSave:' + encodeURIComponent(''));
          state.topicLabel = ''; state.topicUrl = null; state.topicVisible = true;
          state.topicEditing = false;
          hideOverlay();
          renderTopic(); syncMenuFromState();
        });
      }
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

    // custom events from menu.js
    document.addEventListener('ep:close-room', () => {
      if (!state.isHost) return;
      const de  = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
      const msg = de ? 'Diesen Raum für alle schließen?' : 'Close this room for everyone?';
      if (confirm(msg)) send('closeRoom');
    });

    document.addEventListener('ep:sequence-change', (ev) => {
      const id = ev?.detail?.id; if (!id) return;
      if (!state.isHost) return;
      send('sequence:' + encodeURIComponent(normalizeSeq(id)));
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

    // specials toggle (client-only)
    document.addEventListener('ep:specials-toggle', (ev) => {
      if (!state.isHost) return;
      const on = !!(ev && ev.detail && ev.detail.on);
      state.allowSpecials = on;
      syncMenuFromState();
      renderCards();
    });

    // hard/soft mode toggle (client-only)
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
  }

  // --- helpers ---------------------------------------------------------------
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function boot(){ wireOnce(); syncHostClass(); connectWS(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // --- end -------------------------------------------------------------------
})();
