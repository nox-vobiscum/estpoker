/* room.js v42 — inline topic edit; hard/soft reveal disabled+tooltip; specials toggle; host-only actions; chip/outlier fixes
   Highlights:
   - Topic edit is inline: the input replaces the display in the same row while editing.
   - Host can click the (empty) topic row to start editing; when a link/text exists, only the Edit button starts edit mode.
   - In hard mode, Reveal stays visible but disabled with a tooltip until everyone voted.
   - Non-host never sees Topic edit/clear actions.
   - Empty votes render a grey/special chip (not green).
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
    allowSpecials: true,

    // Topic edit state: never auto-open on refresh/host transfer
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
  // Always ask server to set (or confirm) our current display name.
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
        const wasHost = state.isHost;
        const me = state.participants.find(p => p && p.name === state.youName);
        state.isHost = !!(me && me.isHost);
        if (!state.isHost) {
          state.topicEditing = false;
        } else if (!wasHost && state.isHost) {
          state.topicEditing = false; // do not auto-open after transfer
        }

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

    // Hard mode: button visible but disabled until everyone voted
    const hardGateOK = !state.hardMode || allEligibleVoted();

    const showReveal = (!state.votesRevealed && state.isHost);   // always show for host pre-reveal
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

  // --- topic row (inline edit) ----------------------------------------------
  function isDe(){ return (document.documentElement.lang || 'en').toLowerCase().startsWith('de'); }

  // NEW: detect compact/mobile context (viewport + touch UA hints)
  function isMobileCompact(){
    try {
      if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) return true;
      const ua = navigator.userAgent || '';
      return /Android|iPhone|iPad|iPod/i.test(ua);
    } catch { return false; }
  }

  // NEW: lightweight topic edit dialog (icon-only on mobile); created lazily
  function ensureTopicDialog(){
    let dlg = document.querySelector('dialog.ep-topic-dialog');
    if (dlg) return dlg;

    dlg = document.createElement('dialog');
    dlg.className = 'ep-topic-dialog';
    // Minimal inline styling that respects existing CSS vars (no global CSS changes)
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
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doSave(); }
    });

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';

    const mkBtn = (labelEmoji, aria, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = labelEmoji;  // icon-only; visible text stays out of i18n files
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

    // actions
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

    // Order: Save (left) — Clear (right)
    actions.appendChild(saveBtn);
    actions.appendChild(clearBtn);
    actions.appendChild(cancelBtn);

    wrap.appendChild(title);
    wrap.appendChild(input);
    wrap.appendChild(actions);
    dlg.appendChild(wrap);

    document.body.appendChild(dlg);

    // Expose handles on element for reuse
    dlg._input = input;
    dlg._save  = saveBtn;
    dlg._clear = clearBtn;

    return dlg;
  }

  // NEW: open dialog or fallback to prompt
  function showTopicDialog(){
    try {
      const dlg = ensureTopicDialog();
      dlg._input.value = state.topicLabel || '';
      // Keep placeholder current per language
      dlg._input.placeholder = isDe()
        ? 'Anforderung kurz beschreiben oder JIRA-Link einfügen'
        : 'Briefly describe requirement or paste JIRA link';

      if (typeof dlg.showModal === 'function') {
        dlg.showModal();
        setTimeout(() => { try { dlg._input.focus(); } catch {} }, 0);
      } else {
        // Fallback: native prompt (OK=Save, Cancel=abort; empty string clears)
        const v = prompt(
          isDe() ? 'Ticket/Topic bearbeiten:' : 'Edit ticket/topic:',
          state.topicLabel || ''
        );
        if (v === null) return;
        send('topicSave:' + encodeURIComponent(v));
      }
    } catch (e) {
      console.warn(TAG, 'dialog failed, falling back to inline', e);
      state.topicEditing = true;
      renderTopic();
    }
  }

  function ensureInlineTopicControls() {
    const row = $('#topicRow'); if (!row) return;

    // create inline input once
    if (!$('#topicInputInline')) {
      const input = document.createElement('input');
      input.id = 'topicInputInline';
      input.type = 'text';
      input.className = 'topic-inline-input';
      input.style.gridColumn = '2';
      input.placeholder = isDe()
        ? 'Anforderung kurz beschreiben oder JIRA-Link einfügen'
        : 'Briefly describe requirement or paste JIRA link';
      input.autocomplete = 'off';
      input.spellcheck = false;
      row.appendChild(input);
    }

    // ensure save/cancel exist inside actions
    const actions = row.querySelector('.topic-actions');
    if (actions && !$('#topicSaveInline')) {
      const mkBtn = (id, cls, html, title) => {
        const b = document.createElement('button');
        b.id = id; b.type = 'button';
        b.className = `btn ${cls}`;
        b.innerHTML = html;
        if (title) b.setAttribute('title', title);
        return b;
      };
      const saveTxt = isDe() ? 'Speichern' : 'Save';
      const cancTxt = isDe() ? 'Abbrechen' : 'Cancel';
      actions.appendChild(mkBtn('topicSaveInline', 'primary', `💾 <span>${saveTxt}</span>`, saveTxt));
      actions.appendChild(mkBtn('topicCancelInline', 'neutral', `✖ <span>${cancTxt}</span>`, cancTxt));

      // normalize existing Edit / Clear into buttons with unified style
      const editBtn = $('#topicEditBtn');
      const clrBtn  = $('#topicClearBtn');
      if (editBtn) {
        editBtn.classList.add('btn','neutral');
        editBtn.innerHTML = (isDe()? '✏️ <span>Bearbeiten</span>' : '✏️ <span>Edit</span>');
      }
      if (clrBtn) {
        clrBtn.classList.add('btn','danger');
        clrBtn.innerHTML = (isDe()? '🧹 <span>Feld leeren</span>' : '🧹 <span>Clear field</span>');
      }
    }
  }

  function renderTopic() {
    const row  = $('#topicRow');
    const disp = $('#topicDisplay');
    if (!row || !disp) return;

    ensureInlineTopicControls();

    const input     = $('#topicInputInline');
    const actions   = row.querySelector('.topic-actions');
    const editBtn   = $('#topicEditBtn');
    const clearBtn  = $('#topicClearBtn');
    const saveBtn   = $('#topicSaveInline');
    const cancelBtn = $('#topicCancelInline');

    // display content
    if (state.topicLabel && state.topicUrl) {
      disp.innerHTML = `<a href="${encodeURI(state.topicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.topicLabel)}</a>`;
    } else if (state.topicLabel) {
      disp.textContent = state.topicLabel;
    } else {
      disp.textContent = '–';
    }

    // host-only actions
    if (actions) actions.style.display = state.isHost ? '' : 'none';

    // row clickability (only empty topic & not editing)
    const canClickToEdit = !!(state.isHost && !state.topicLabel && !state.topicEditing);
    row.classList.toggle('editable', canClickToEdit);

    // show/hide
    const showRow  = !!state.topicVisible;
    const editing  = !!(state.isHost && state.topicEditing);
    row.style.display = showRow ? '' : 'none';

    if (input) {
      input.placeholder = isDe()
        ? 'Anforderung kurz beschreiben oder JIRA-Link einfügen'
        : 'Briefly describe requirement or paste JIRA link';
    }

    if (editing) {
      if (input) { input.value = state.topicLabel || ''; input.style.display = ''; input.focus(); }
      disp.style.display = 'none';
      if (editBtn)   editBtn.style.display = 'none';
      if (clearBtn)  clearBtn.style.display = '';
      if (saveBtn)   saveBtn.style.display  = '';
      if (cancelBtn) cancelBtn.style.display = '';
    } else {
      if (input) input.style.display = 'none';
      disp.style.display = '';
      if (editBtn)   editBtn.style.display = state.isHost ? '' : 'none';
      if (clearBtn)  clearBtn.style.display = (state.isHost && state.topicLabel) ? '' : 'none';
      if (saveBtn)   saveBtn.style.display  = 'none';
      if (cancelBtn) cancelBtn.style.display = 'none';
    }
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
    setRowDisabled('menuSpecialsToggle',   !state.isHost);
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
    // Defer UI switch to server update to avoid transient "N/A"
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

    // Inline + Mobile dialog topic editor (host-only)
    {
      const row      = $('#topicRow');
      const disp     = $('#topicDisplay');
      const editBtn  = $('#topicEditBtn');
      const clearBtn = $('#topicClearBtn');

      ensureInlineTopicControls();
      const input     = $('#topicInputInline');
      const saveBtn   = $('#topicSaveInline');
      const cancelBtn = $('#topicCancelInline');

      // unified begin-edit entry: inline on desktop, dialog on mobile
      function beginTopicEdit(){
        if (!state.isHost) return;
        if (isMobileCompact()) {
          showTopicDialog();
        } else {
          state.topicEditing = true;
          renderTopic();
        }
      }

      if (row) {
        row.addEventListener('click', (e) => {
          if (!state.isHost || state.topicLabel || state.topicEditing) return;
          if (e.target.closest('button,a,input')) return;
          beginTopicEdit();
        });
      }

      if (editBtn) {
        editBtn.addEventListener('click', () => {
          if (!state.isHost) return;
          beginTopicEdit();
        });
      }
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          state.topicEditing = false;
          renderTopic();
        });
      }
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          if (!state.isHost || !input) return;
          const val = input.value || '';
          send('topicSave:' + encodeURIComponent(val));
          state.topicEditing = false;
          renderTopic();
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (!state.isHost) return;
          send('topicSave:' + encodeURIComponent(''));
          state.topicLabel = ''; state.topicUrl = null; state.topicVisible = true;
          state.topicEditing = false;
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
