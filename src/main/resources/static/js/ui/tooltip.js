/* Accessible tooltip (single bubble) — mouse-only hover, keyboard focus ok */
(function () {
  if (window.__epTooltipInit) return;
  window.__epTooltipInit = true;

  let tipEl, isScrolling = false, hideTimer = null;

  function ensureTip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tooltip';
      tipEl.setAttribute('role', 'tooltip');
      tipEl.style.position = 'absolute';
      tipEl.style.display = 'none';
      tipEl.style.pointerEvents = 'none';
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function hideTip() {
    if (!tipEl) return;
    tipEl.style.display = 'none';
    tipEl.style.visibility = 'hidden';
  }
  window.__epTooltipHide = hideTip; // allow other scripts (e.g., menu) to hide

  function placeTip(target) {
    const text = target.getAttribute('data-tooltip');
    if (!text) return;

    const el = ensureTip();
    el.textContent = text;
    el.style.visibility = 'hidden';
    el.style.display = 'block';

    const r = target.getBoundingClientRect();
    const tr = el.getBoundingClientRect();

    let top = window.scrollY + r.top - tr.height - 8;
    let left = window.scrollX + r.left + (r.width - tr.width) / 2;

    // keep in viewport horizontally
    left = Math.max(window.scrollX + 4, Math.min(left, window.scrollX + window.innerWidth - tr.width - 4));
    // if not enough space above, place below
    if (top < window.scrollY + 4) top = window.scrollY + r.bottom + 8;

    el.style.top = top + 'px';
    el.style.left = left + 'px';
    el.style.visibility = 'visible';
  }

  function findTarget(node) {
    let n = node;
    while (n && n !== document) {
      if (n.nodeType === 1 && n.hasAttribute('data-tooltip')) return n;
      n = n.parentNode;
    }
    return null;
  }

  // --- Show/hide logic ----------------------------------------------------
  document.addEventListener('pointerover', (e) => {
    if (isScrolling) return;                // ignore during/just-after scroll
    if (e.pointerType && e.pointerType !== 'mouse') return; // hover only on mouse
    const t = findTarget(e.target);
    if (t) placeTip(t);
  }, true);

  document.addEventListener('pointerout', (e) => {
    const t = findTarget(e.target);
    if (t) hideTip();
  }, true);

  // Keyboard accessibility
  document.addEventListener('focusin', (e) => {
    const t = findTarget(e.target);
    if (t) placeTip(t);
  }, true);
  document.addEventListener('focusout', (e) => {
    const t = findTarget(e.target);
    if (t) hideTip();
  }, true);

  // Hide on interactions that imply scroll/touch
  function startScrollMask() {
    isScrolling = true;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { isScrolling = false; }, 150);
    hideTip();
  }
  window.addEventListener('scroll', startScrollMask, true);
  window.addEventListener('wheel', startScrollMask, { passive: true, capture: true });
  window.addEventListener('touchstart', startScrollMask, { passive: true, capture: true });
  window.addEventListener('pointerdown', startScrollMask, true);
})();
