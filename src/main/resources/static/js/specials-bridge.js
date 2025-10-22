/* specials-bridge.js v1.1 — single source of truth for Specials palette
   Supports BOTH markups:
   A) New:   <button class="spc" data-id="coffee" aria-pressed="false">…</button>
   B) Legacy:<label class="spc"><input type="checkbox" value="coffee">…</label>

   Responsibilities:
   - Handle clicks/keys on the palette only (no row side-effects)
   - Maintain .on + aria-pressed (buttons) or input.checked (labels)
   - Publish ep:specials-set { ids:[...] } with a stable order
   - React to ep:specials-toggle { on:boolean } for visibility
   - Disable interaction for non-hosts while keeping focusability
   - Provide a small "Select all" action (host only)
*/

(() => {
  'use strict';
  if (window.__epSpecialsBridgeVer) return; // guard against double load
  window.__epSpecialsBridgeVer = 'v1.1';
  console.info('[specials-bridge] v1.1 loaded');

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const ROW_PICK = $('#rowSpecialsPick');
  if (!ROW_PICK) {
    console.warn('[specials-bridge] #rowSpecialsPick not found – nothing to do');
    return;
  }
  const WRAP = $('.specials-icons', ROW_PICK) || ROW_PICK;
  const BTN_SEL_ALL = $('#spcSelectAll', ROW_PICK);

  // Stable order used for sorting + canonicalization
  const SPECIALS_ORDER = ['coffee','speech','telescope','waiting','dependency','risk','relevance','help','question','?','❓','☕','∞'];

  // Map various labels/values → canonical ids
  function canon(id) {
    const s = String(id || '').trim().toLowerCase();
    switch (s) {
      case '☕': case 'coffee': case 'c': return 'coffee';
      case '💬': case 'speech': case 'talk': return 'speech';
      case '🔭': case 'telescope': case 'focus': return 'telescope';
      case '⏳': case 'hourglass': case 'waiting': return 'waiting';
      case '🔗': case 'dep': case 'dependency': return 'dependency';
      case '⚠': case 'warn': case 'risk': return 'risk';
      case '🎯': case 'relevance': case 'rel': return 'relevance';
      case '?': case '❓': case 'help': case 'question': return 'help';
      case '∞': case 'infinity': return '∞';
      default: return s;
    }
  }
  const byOrder = (a, b) => {
    const ia = SPECIALS_ORDER.indexOf(a), ib = SPECIALS_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  };

  // -------- Visibility: only via [hidden]/[aria-hidden] (no display hacks)
  function setPaletteVisible(show) {
    ROW_PICK.hidden = !show;
    ROW_PICK.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  // -------- Detect markup mode
  const HAS_BUTTONS = !!$('.spc[aria-pressed]', WRAP);
  const HAS_LABELS  = !!$('label.spc input[type="checkbox"]', WRAP);

  // -------- Reading & writing selection
  function readSelected() {
    if (HAS_BUTTONS) {
      return $$('.spc[aria-pressed="true"], .spc.on', WRAP)
        .map(el => canon(el.dataset.id || el.value))
        .filter(Boolean)
        .sort(byOrder);
    }
    // legacy
    return $$('label.spc input[type="checkbox"]:checked', WRAP)
      .map(inp => canon(inp.value || inp.closest('label')?.dataset?.id))
      .filter(Boolean)
      .sort(byOrder);
  }

  function writeSelected(idsSet) {
    if (HAS_BUTTONS) {
      $$('.spc', WRAP).forEach(btn => {
        const id = canon(btn.dataset.id || btn.value);
        const on = idsSet.has(id);
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', String(on));
      });
      return;
    }
    // legacy
    $$('label.spc', WRAP).forEach(lbl => {
      const inp = $('input[type="checkbox"]', lbl);
      if (!inp) return;
      const id = canon(inp.value || lbl.dataset.id);
      const on = idsSet.has(id);
      inp.checked = on;
      lbl.classList.toggle('on', on);
      lbl.setAttribute('aria-checked', String(on));
    });
  }

  function dispatchSet() {
    const ids = readSelected();
    try {
      document.dispatchEvent(new CustomEvent('ep:specials-set', { detail: { ids } }));
    } catch (e) {
      console.warn('[specials-bridge] dispatch ep:specials-set failed', e);
    }
  }

  // -------- Event fences: keep row/overlay handlers from interfering
  // Pointer events: stop in capture so the row/overlay never sees them.
  ['pointerdown','mousedown','touchstart'].forEach(type => {
    ROW_PICK.addEventListener(type, (e) => {
      if (e.target && ROW_PICK.contains(e.target)) e.stopPropagation();
    }, true /* capture */);
  });
  // Click: allow button handlers first, then stop in bubble so rows don't react.
  ROW_PICK.addEventListener('click', (e) => {
    if (e.target && ROW_PICK.contains(e.target)) e.stopPropagation();
  }, false /* bubble */);
  // Keyboard: allow WRAP/button key handlers to run, then stop in bubble.
  ROW_PICK.addEventListener('keydown', (e) => {
    if (e.target && ROW_PICK.contains(e.target)) e.stopPropagation();
  }, false /* bubble */);

  // -------- Interaction wiring (buttons OR labels)
  function togglePressedButton(btn) {
    const isHost = document.body.classList.contains('is-host');
    if (!isHost) return;
    const on = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!on));
    btn.classList.toggle('on', !on);
    dispatchSet();
  }

  function wireButtons() {
    WRAP.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.spc[aria-pressed]');
      if (!btn || !WRAP.contains(btn)) return;
      e.preventDefault();
      togglePressedButton(btn);
    });
    WRAP.addEventListener('keydown', (e) => {
      const btn = e.target?.closest?.('.spc[aria-pressed]');
      if (!btn || !WRAP.contains(btn)) return;
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        togglePressedButton(btn);
      }
    });
  }

  function wireLabels() {
    // MVP: rely on native label/checkbox click; just dispatch on change
    $$('label.spc input[type="checkbox"]', WRAP).forEach(inp => {
      inp.addEventListener('change', () => {
        const lbl = inp.closest('label.spc');
        if (lbl) {
          const on = !!inp.checked;
          lbl.classList.toggle('on', on);
          lbl.setAttribute('aria-checked', String(on));
        }
        dispatchSet();
      });
    });
    // Prevent non-hosts from toggling while keeping focusability
    const updateEnabled = () => {
      const isHost = document.body.classList.contains('is-host');
      $$('label.spc input[type="checkbox"]', WRAP).forEach(inp => { inp.disabled = !isHost; });
      $$('label.spc', WRAP).forEach(lbl => {
        lbl.classList.toggle('disabled', !isHost);
        if (!isHost) lbl.setAttribute('aria-disabled', 'true'); else lbl.removeAttribute('aria-disabled');
      });
    };
    updateEnabled();
    new MutationObserver(updateEnabled).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (HAS_BUTTONS) wireButtons();
  if (HAS_LABELS)  wireLabels();

  // -------- "Select all" action (host only)
  function selectAll() {
    if (HAS_BUTTONS) {
      $$('.spc', WRAP).forEach(btn => {
        btn.classList.add('on');
        btn.setAttribute('aria-pressed', 'true');
      });
    } else {
      $$('label.spc input[type="checkbox"]', WRAP).forEach(inp => {
        inp.checked = true;
        const lbl = inp.closest('label.spc');
        lbl?.classList.add('on');
        lbl?.setAttribute('aria-checked', 'true');
      });
    }
    dispatchSet();
  }

  if (BTN_SEL_ALL) {
    const handleSelectAll = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isHost = document.body.classList.contains('is-host');
      if (!isHost) return;
      selectAll();
    };
    BTN_SEL_ALL.addEventListener('click', handleSelectAll);
    BTN_SEL_ALL.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') handleSelectAll(e);
    });
  }

  // -------- Palette enable/disable for non-hosts (buttons path + action button)
  function updateButtonsEnabled() {
    const isHost = document.body.classList.contains('is-host');
    if (HAS_BUTTONS) {
      WRAP.classList.toggle('disabled', !isHost);
      try { WRAP.style.pointerEvents = isHost ? '' : 'none'; } catch {}
    }
    if (BTN_SEL_ALL) {
      BTN_SEL_ALL.classList.toggle('disabled', !isHost);
      BTN_SEL_ALL.setAttribute('aria-disabled', String(!isHost));
      try { BTN_SEL_ALL.style.pointerEvents = isHost ? '' : 'none'; } catch {}
      if (!isHost) BTN_SEL_ALL.setAttribute('tabindex', '-1'); else BTN_SEL_ALL.removeAttribute('tabindex');
    }
  }
  updateButtonsEnabled();
  new MutationObserver(updateButtonsEnabled).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // -------- Visibility reacts to master toggle from menu.js
  document.addEventListener('ep:specials-toggle', (e) => {
    const on = !!(e && e.detail && e.detail.on);
    setPaletteVisible(on);
    if (on) dispatchSet();
    else {
      // Turning OFF → empty selection is broadcast so grids can clear
      try { document.dispatchEvent(new CustomEvent('ep:specials-set', { detail: { ids: [] } })); } catch {}
    }
  });

  // -------- Initial sync on load (read UI → broadcast)
(function initialSync(){
  // TS-friendly typing in .js (JSDoc instead of TS "as any")
  /** @type {HTMLInputElement|null} */
  const sw = document.getElementById('menuSpecialsToggle');
  if (sw) {
    const aria = sw.getAttribute('aria-checked');
    const on = aria === 'true' ? true : aria === 'false' ? false : !!sw.checked;
    setPaletteVisible(on);
  }
  // Reflect current pressed/checked visuals for safety and emit state
  const ids = readSelected();
  writeSelected(new Set(ids));
  dispatchSet();
})();

})();
