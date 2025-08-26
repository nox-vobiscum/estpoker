/* Accessible tooltip (single bubble) — mouse hover only; keyboard focus OK
   Extras:
   - Hides on scroll/touch/wheel/pointerdown and Esc
   - Hides when app menu opens (observes body.menu-open or overlay visibility)
   - Hides while scrolling inside the menu panel without touching menu.js
*/
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
  // allow other scripts (e.g., menu.js) to hide explicitly
  window.__epTooltipHide = hideTip;

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
    let placedBelow = false;
    let left = window.scrollX + r.left + (r.width - tr.width) / 2;

    // keep in viewport horizontally
    left = Math.max(window.scrollX + 4, Math.min(left, window.scrollX + window.innerWidth - tr.width - 4));
    // if not enough space above, place below
    if (top < window.scrollY + 4) { top = window.scrollY + r.bottom + 8; placedBelow = true; }

    el.style.top = top + 'px';
    el.style.left = left + 'px';
    el.style.visibility = 'visible';
    el.dataset.pos = placedBelow ? 'below' : 'above';
  }

  function findTarget(node) {
    let n = node;
    while (n && n !== document) {
      if (n.nodeType === 1 && n.hasAttribute('data-tooltip')) return n;
      n = n.parentNode;
    }
    return null;
  }

  function isInsideMenu(target){
    const overlay = document.getElementById('appMenuOverlay');
    return !!(overlay && overlay.contains(target));
  }

  // --- Show/hide core logic ------------------------------------------------
  document.addEventListener('pointerover', (e) => {
    if (isScrolling) return;                // ignore during/just-after scroll
    if (e.pointerType && e.pointerType !== 'mouse') return; // hover only on mouse
    const t = findTarget(e.target);
    if (t) placeTip(t);
  }, true);

  document.addEventListener('pointerout', (e) => {
    const from = findTarget(e.target);
    const to   = findTarget(e.relatedTarget);
    if (!from) return;
    if (to && (from === to)) return;
    hideTip();
  }, true);

  // Keyboard accessibility: suppress tooltips *on focus* while menu is open
  document.addEventListener('focusin', (e) => {
    if (document.body.classList.contains('menu-open')) return; // don't pop tips on menu auto-focus
    const t = findTarget(e.target);
    if (t && !isInsideMenu(t)) placeTip(t); // ignore focus tips inside the menu; hover still works
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
  // Page-level interactions
  window.addEventListener('scroll', startScrollMask, true);
  window.addEventListener('wheel', startScrollMask, { passive: true, capture: true });
  window.addEventListener('touchstart', startScrollMask, { passive: true, capture: true });
  window.addEventListener('touchmove', startScrollMask, { passive: true, capture: true });
  window.addEventListener('pointerdown', startScrollMask, true);
  window.addEventListener('resize', startScrollMask);

  // Esc closes any tooltip
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTip();
  });

  // --- Menu integration without touching menu.js ---------------------------
  function observeMenuState() {
    try {
      const bodyObs = new MutationObserver(() => {
        if (document.body.classList.contains('menu-open')) hideTip();
      });
      bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

      const overlay = document.getElementById('appMenuOverlay');
      if (overlay) {
        const ovObs = new MutationObserver(() => hideTip());
        ovObs.observe(overlay, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
      }
    } catch (_) { /* no-op */ }
  }

  function hookMenuScroll() {
    const overlay = document.getElementById('appMenuOverlay');
    const panel = overlay ? overlay.querySelector('.menu-panel') : null;
    overlay && overlay.addEventListener('scroll', startScrollMask, { passive: true });
    panel   && panel.addEventListener('scroll', startScrollMask, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observeMenuState();
      hookMenuScroll();
    });
  } else {
    observeMenuState();
    hookMenuScroll();
  }

  // Extra hides for odd cases
  window.addEventListener('orientationchange', hideTip, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hideTip(); }, true);

})();
