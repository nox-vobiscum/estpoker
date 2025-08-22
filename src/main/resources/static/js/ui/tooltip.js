/* Lightweight, accessible tooltips without using title=.
 * Usage:
 *   <span class="has-tooltip" data-tooltip="Full text">Short…</span>
 * The module attaches listeners to .has-tooltip (and [data-tooltip]).
 */
(function () {
  const SELECTOR = '.has-tooltip,[data-tooltip]';
  let tipEl = null;
  let currentAnchor = null;

  // Create a single tooltip element for the whole app
  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'app-tooltip'; // styled via tooltip.css
    tipEl.setAttribute('role', 'tooltip');
    tipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function getTooltipText(el) {
    // Prefer data-tooltip; fallback to aria-label if present
    return el.getAttribute('data-tooltip') || el.getAttribute('aria-label') || '';
  }

  function positionTip(anchor) {
    const rect = anchor.getBoundingClientRect();
    const tip = ensureTip();
    const padding = 8; // spacing from anchor

    // Default above, fallback below if not enough space
    tip.style.visibility = 'hidden';
    tip.style.left = '0px';
    tip.style.top = '0px';
    tip.style.maxWidth = Math.min(window.innerWidth - 24, 360) + 'px';

    // Force reflow to measure size
    const { offsetWidth: w, offsetHeight: h } = tip;

    // Prefer above
    let top = rect.top - h - padding;
    let left = rect.left + (rect.width - w) / 2;

    // Clamp horizontally
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));

    // If above overflows, place below
    if (top < 8) {
      top = rect.bottom + padding;
    }

    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.visibility = 'visible';
  }

  function showTip(e) {
    const el = e.currentTarget;
    const text = getTooltipText(el);
    if (!text) return;
    const tip = ensureTip();
    tip.textContent = text;
    tip.setAttribute('aria-hidden', 'false');
    currentAnchor = el;
    positionTip(el);
  }

  function hideTip() {
    if (!tipEl) return;
    tipEl.setAttribute('aria-hidden', 'true');
    tipEl.style.visibility = 'hidden';
    currentAnchor = null;
  }

  function bind(el) {
    el.addEventListener('mouseenter', showTip);
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('focus', showTip, true);
    el.addEventListener('blur', hideTip, true);
  }

  function init() {
    // Bind existing
    document.querySelectorAll(SELECTOR).forEach(bind);
    // Observe future elements
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches && n.matches(SELECTOR)) bind(n);
          n.querySelectorAll && n.querySelectorAll(SELECTOR).forEach(bind);
        });
      });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('scroll', () => currentAnchor && positionTip(currentAnchor), true);
    window.addEventListener('resize', () => currentAnchor && positionTip(currentAnchor));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
