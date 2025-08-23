/* Accessible tooltips for elements with [data-tooltip].
 * No native title= usage. Single bubble reused across the page.
 */
(function () {
  // Run once per page
  if (window.__epTooltipInit) return;
  window.__epTooltipInit = true;

  let tipEl;

  function ensureTip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tooltip';
      tipEl.setAttribute('role', 'tooltip');
      tipEl.style.position = 'absolute';
      tipEl.style.display = 'none';
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function showTip(target) {
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

    // Keep inside viewport horizontally
    const minL = window.scrollX + 4;
    const maxL = window.scrollX + window.innerWidth - tr.width - 4;
    left = Math.max(minL, Math.min(left, maxL));

    // If not enough space above, place below
    if (top < window.scrollY + 4) top = window.scrollY + r.bottom + 8;

    el.style.top = top + 'px';
    el.style.left = left + 'px';
    el.style.visibility = 'visible';
  }

  function hideTip() {
    if (tipEl) {
      tipEl.style.display = 'none';
      tipEl.style.visibility = 'hidden';
    }
  }

  function findTarget(node) {
    let n = node;
    while (n && n !== document) {
      if (n.nodeType === 1 && n.hasAttribute('data-tooltip')) return n;
      n = n.parentNode;
    }
    return null;
  }

  document.addEventListener('pointerover', (e) => {
    const t = findTarget(e.target);
    if (t) showTip(t);
  });
  document.addEventListener('pointerout', (e) => {
    const t = findTarget(e.target);
    if (t) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const t = findTarget(e.target);
    if (t) showTip(t);
  });
  document.addEventListener('focusout', (e) => {
    const t = findTarget(e.target);
    if (t) hideTip();
  });
})();
