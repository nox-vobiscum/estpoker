/* menu.js v17 — robust open/close; full-row switches; split-flags (US↙/GB↘, DE↙/AT↘); data-tooltip only */
(() => {
  'use strict';

  const TAG = '[MENU]';
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  // --- Nodes ---------------------------------------------------------------
  const btn      = $('#menuButton');
  const overlay  = $('#appMenuOverlay');
  const panel    = overlay ? overlay.querySelector('.menu-panel') : null;
  const backdrop = overlay ? overlay.querySelector('[data-close]') : null;

  if (!btn || !overlay || !panel) {
    console.error(TAG, 'Required markup not found.');
    return;
  }

  // --- Open / Close --------------------------------------------------------
  let lastFocus = null;
  const isOpen = () => !overlay.classList.contains('hidden');

  function openMenu() {
    if (isOpen()) return;
    lastFocus = document.activeElement;

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-open');
    btn.setAttribute('aria-expanded', 'true');

    const first = panel.querySelector('button,[role="button"],input,[tabindex]:not([tabindex="-1"])') || panel;
    try { first.focus({ preventScroll: true }); } catch {}
  }

  function closeMenu() {
    if (!isOpen()) return;

    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false');

    if (lastFocus && document.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch {}
    }
  }

  on(btn, 'click', openMenu);
  on(backdrop, 'click', closeMenu);
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      closeMenu();
    }
  });
  // click outside closes
  on(overlay, 'mousedown', (e) => {
    if (!panel.contains(e.target)) closeMenu();
  });

  // --- Lightweight tooltip (data-tooltip) ----------------------------------
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  document.body.appendChild(tooltip);

  function showTooltip(el) {
    const text = el.getAttribute('data-tooltip');
    if (!text) return;

    tooltip.textContent = text;
    tooltip.style.display = 'block';
    tooltip.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const top  = r.bottom + 8 + window.scrollY;
      const left = Math.max(8, r.left + r.width / 2 - tooltip.offsetWidth / 2 + window.scrollX);
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.visibility = 'visible';
    });
  }
  function hideTooltip() {
    tooltip.style.display = 'none';
    tooltip.style.visibility = 'hidden';
  }
  overlay.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tooltip]');
    if (el) showTooltip(el);
  });
  overlay.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-tooltip]')) hideTooltip();
  });

  // --- Theme handling ------------------------------------------------------
  const themeBtns = {
    light:  $('#themeLight'),
    dark:   $('#themeDark'),
    system: $('#themeSystem'),
  };
  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem('ep-theme');
    } else {
      root.setAttribute('data-theme', mode);
      localStorage.setItem('ep-theme', mode);
    }
    Object.entries(themeBtns).forEach(([k, b]) => b && b.setAttribute('aria-pressed', String(k === mode)));
  }
  on(themeBtns.light,  'click', () => applyTheme('light'));
  on(themeBtns.dark,   'click', () => applyTheme('dark'));
  on(themeBtns.system, 'click', () => applyTheme('system'));
  applyTheme(localStorage.getItem('ep-theme') || 'system');

  // --- Language row (split flags) ------------------------------------------
  const langRow     = $('#langRow');
  const langCurrent = $('#langCurrent');
  const flagA       = $('.flag-split .flag-a');
  const flagB       = $('.flag-split .flag-b');

  const isDe = () => (document.documentElement.lang || 'en').toLowerCase().startsWith('de');
  const cur  = () => (isDe() ? 'de' : 'en');
  const next = () => (cur() === 'en' ? 'de' : 'en');

  function updateLangLabel() {
    if (langCurrent) langCurrent.textContent = isDe() ? 'Deutsch' : 'English';
  }
  function updateSplitFlags() {
    if (!flagA || !flagB) return;
    if (isDe()) {
      // oben-links: DE, unten-rechts: AT
      flagA.src = '/flags/de.svg';
      flagB.src = '/flags/at.svg';
    } else {
      // oben-links: US, unten-rechts: GB  (gewünschte Reihenfolge)
      flagA.src = '/flags/us.svg';
      flagB.src = '/flags/gb.svg';
    }
  }
  on(langRow, 'click', () => {
    const url = new URL(location.href);
    url.searchParams.set('lang', next());
    location.href = url.toString();
  });
  updateLangLabel(); updateSplitFlags();

  // --- Switch rows (full row clickable) ------------------------------------
  // helper: clicking anywhere on .menu-item.switch toggles its checkbox
  $$('.menu-item.switch').forEach(row => {
    on(row, 'click', (e) => {
      // ignore direct clicks on the control itself to not double-toggle
      if (e.target.closest('input')) return;
      const input = row.querySelector('input.switch-control');
      if (!input || input.disabled) return;
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // Auto-reveal
  const arToggle = $('#menuAutoRevealToggle');
  on(arToggle, 'change', (e) => {
    const onv = !!e.target.checked;
    document.dispatchEvent(new CustomEvent('ep:auto-reveal-toggle', { detail: { on: onv } }));
    const st = $('#menuArStatus');
    if (st) st.textContent = onv ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');
  });

  // Ticket/Story visibility
  const topicToggle = $('#menuTopicToggle');
  on(topicToggle, 'change', (e) => {
    const onv = !!e.target.checked;
    document.dispatchEvent(new CustomEvent('ep:topic-toggle', { detail: { on: onv } }));
    const st = $('#menuTopicStatus');
    if (st) st.textContent = onv ? (isDe() ? 'An' : 'On') : (isDe() ? 'Aus' : 'Off');
  });

  // Participation
  const partToggle = $('#menuParticipationToggle');
  on(partToggle, 'change', (e) => {
    const estimating = !!e.target.checked;
    document.dispatchEvent(new CustomEvent('ep:participation-toggle', { detail: { estimating } }));
    const st = $('#menuPartStatus');
    if (st) st.textContent = estimating ? (isDe() ? 'Ich schätze mit' : "I'm estimating")
                                        : (isDe() ? 'Beobachter:in' : 'Observer');
  });

  // --- Sequences (radios) + tooltips ---------------------------------------
  const seqRoot = $('#menuSeqChoice');
  if (seqRoot) {
    on(seqRoot, 'change', (e) => {
      const r = e.target;
      if (r && r.matches('input[type="radio"][name="menu-seq"]')) {
        document.dispatchEvent(new CustomEvent('ep:sequence-change', { detail: { id: r.value } }));
      }
    });

    const tips = {
      'fib.scrum': seqRoot.dataset.tipFibScrum,
      'fib.enh'  : seqRoot.dataset.tipFibEnh,
      'fib.math' : seqRoot.dataset.tipFibMath,
      'pow2'     : seqRoot.dataset.tipPow2,
      'tshirt'   : seqRoot.dataset.tipTshirt,
    };
    $$('.radio-row', seqRoot).forEach(label => {
      const input = $('input', label);
      const id = input && input.value;
      if (id && tips[id]) label.setAttribute('data-tooltip', tips[id]);
    });
  }

  // --- Close room -----------------------------------------------------------
  const closeBtn = $('#closeRoomBtn');
  on(closeBtn, 'click', () => {
    document.dispatchEvent(new CustomEvent('ep:close-room'));
  });

  console.info(TAG, 'Ready.');
})();
