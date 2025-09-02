/* room.js v38 — hard/soft reveal mode + specials toggle + host-only topic actions + chip fixes
   Notes:
   - Hard mode: host can reveal only when all eligible participants have selected a card.
   - Soft mode: host can reveal anytime (default).
   - Specials toggle (host-only): hides/shows special card buttons (❓ 💬 ☕ ∞) client-side.
   - Non-hosts do not see topic Edit/Clear buttons (enforced by JS).
   - Empty vote after reveal shows a gray chip (treated as "special", not green).
   - Native title tooltips for "Make host" and "Kick".
   - Average text appends "(n/m)" (numeric/total submitted); specials excluded from numeric calcs.
   - Reveal UI switches only after server update (avoid transient "N/A").
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
    allowSpecials: true, // NEW: default ON

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

    s.onopen = () => { state.connected = true; heartbeat(); };
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
        const seqId = m.sequenceId || state.sequenceId || 'fib.scrum';
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
        state.sequenceId = m.sequenceId || state.sequenceId;

        // host?
        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);

        // clear optimistic selection when server confirms our vote
        if (me && me.vote != null) state._optimisticVote = null;

        syncHostClass();
        renderParticipants();
        renderCards();
        renderResultBar(m);
        renderTopic();
        renderAutoReveal();
        syncMenuFromState();
        syncSequenceInMenu();

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

    // Precompute outliers when revealed
    const outlierVals = computeOutlierValues();

    state.participants.forEach(p => {
      const li = document.createElement('li');
      li.className = 'participant-row';
      if (p.disconnected) li.classList.add('disconnected');
      if (p.isHost) li.classList.add('is-host');

      const idle = isIdle(p);
      const left = document.createElement('span');
      left.className = 'participant-icon';
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
    // Eligible = not observer, not disconnected
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
    // Hide specials entirely if allowSpecials = false
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

    // Hard mode: only show Reveal if everyone voted (non-observers, not disconnected)
    const hardGateOK = !state.hardMode || allEligibleVoted();

    const showReveal = (!state.votesRevealed && state.isHost && hardGateOK);
    const showReset  = ( state.votesRevealed && state.isHost);

    if (revealBtn) {
      revealBtn.style.display = showReveal ? '' : 'none';
      revealBtn.hidden = !showReveal;
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

  // --- topic row -------------------------------------------------------------
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

    // Show/hide rows
    const shouldShow = !!state.topicVisible;
    if (row) row.style.display = shouldShow ? '' : 'none';
    if (edit && !shouldShow) edit.style.display = 'none';

    // Enforce host-only visibility for Edit/Clear group (no CSS dependency)
    const actions = row ? row.querySelector('.topic-actions') : null;
    if (actions) actions.style.display = state.isHost ? '' : 'none';
    if (edit)     edit.style.display   = (state.isHost && !shouldShow) ? '' : 'none';
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

    setRowDisabled('menuAutoRevealToggle', !state.isHost);
    setRowDisabled('menuTopicToggle',      !state.isHost);
    setRowDisabled('menuSpecialsToggle',   !state.isHost); // NEW
    setRowDisabled('menuHardModeToggle',   !state.isHost);

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
    root.querySelectorAll('input[type="radio"][name="menu-seq"]').forEach(r => {
      r.disabled = !state.isHost;
      if (r.disabled) r.closest('label')?.classList.add('disabled');
      else r.closest('label')?.classList.remove('disabled');
    });
    const id = state.sequenceId || '';
    const sel = root.querySelector(`input[type="radio"][name="menu-seq"][value="${CSS.escape(id)}"]`)
             || root.querySelector(`input[type="radio"][name="menu-seq"][value="${CSS.escape(id.replace('.', '-'))}"]`);
    if (sel) { sel.checked = true; sel.setAttribute('aria-checked','true'); }
  }

  // --- global actions --------------------------------------------------------
  function revealCards(){
    if (state.hardMode && !allEligibleVoted()) {
      const isDe = (document.documentElement.lang||'en').toLowerCase().startsWith('de');
      showToast(isDe ? 'Erst aufdecken, wenn alle gewählt haben.' : 'Reveal only after everyone voted.');
      return;
    }
    // Defer UI switch to server update to avoid a transient "N/A"
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

    const avgNum = toNumeric(state.averageVote);
    if (avgNum == null) return new Set();

    const diffs = nums.map(n => Math.abs(n - avgNum));
    const maxDev = Math.max(...diffs);

    const EPS = 1e-6;
    return new Set(nums.filter((n, i) => Math.abs(diffs[i] - maxDev) <= EPS));
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

    // Topic editor (host-only; visibility also enforced in renderTopic)
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
      cancelBtn.addEventListener('click', () => { editBox.style.display = 'none'; $('#topicRow').style.display = ''; });
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
        send('topicSave:' + encodeURIComponent(''));
        state.topicLabel = ''; state.topicUrl = null; state.topicVisible = true;
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
      send(`topicVisible:${on}`);
    });

    document.addEventListener('ep:participation-toggle', (ev) => {
      const estimating = !!(ev && ev.detail && ev.detail.estimating);
      send(`participation:${estimating}`);
    });

    // NEW: specials toggle (client-only)
    document.addEventListener('ep:specials-toggle', (ev) => {
      if (!state.isHost) return; // host-only control
      const on = !!(ev && ev.detail && ev.detail.on);
      state.allowSpecials = on;
      syncMenuFromState();
      renderCards(); // show/hide special buttons immediately
    });

    // hard/soft mode toggle (client-only)
    document.addEventListener('ep:hard-mode-toggle', (ev) => {
      if (!state.isHost) return; // host-only control
      const on = !!(ev && ev.detail && ev.detail.on);
      state.hardMode = on;
      syncMenuFromState();
      renderCards(); // may hide/show reveal button
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
})();
