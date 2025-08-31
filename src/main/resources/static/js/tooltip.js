/* tooltip.js v7 — single bubble, wraps text, live-updates on attribute changes */
(() => {
  'use strict';
  const TAG = '[tooltip]';

  // Create one shared tooltip bubble (styled via CSS .tooltip)
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  document.body.appendChild(tip);

  // State for the currently hovered target carrying data-tooltip
  let curTarget = null;
  let observer = null;
  let raf = 0;

  // Find the closest ancestor with data-tooltip
  function findTarget(el) {
    while (el && el !== document.body) {
      if (el.hasAttribute && el.hasAttribute('data-tooltip')) return el;
      el = el.parentNode;
    }
    return null;
  }

  // Update content from target's attribute
  function setContentFrom(target) {
    const txt = (target?.getAttribute('data-tooltip') ?? '').trim();
    tip.textContent = txt;
    // Show only if there's something to show
    const has = !!txt;
    tip.style.display = has ? 'block' : 'none';
    tip.style.visibility = has ? 'visible' : 'hidden';
  }

  // Observe changes to data-tooltip on the current target
  function attachObserver(target) {
    detachObserver();
    if (!target) return;
    try {
      observer = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'attributes' && m.attributeName === 'data-tooltip') {
            setContentFrom(target);
            // Re-position after content change
            if (curTarget) queuePosition(lastX, lastY);
          }
        }
      });
      observer.observe(target, { attributes: true, attributeFilter: ['data-tooltip'] });
    } catch (e) {
      // no-op (older browsers)
    }
  }
  function detachObserver() {
    try { observer && observer.disconnect(); } catch {}
    observer = null;
  }

  // Keep tooltip within viewport and pick above/below placement
  let lastX = 0, lastY = 0;
  function position(x, y) {
    // Default place above the cursor
    const margin = 10;
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    // Tentative position (we'll clamp)
    let left = x + 12;
    tip.style.left = '0px'; // reset to measure
    tip.style.top  = '0px';
    tip.removeAttribute('data-pos');

    const rect = tip.getBoundingClientRect();
    let top = y - rect.height - margin;

    // If above would go off-screen, flip below
    if (top < 0) {
      top = y + margin;
      tip.setAttribute('data-pos', 'below'); // CSS arrow flips
    }

    // Clamp horizontally inside viewport
    if (left + rect.width + 8 > vw) left = Math.max(8, vw - rect.width - 8);
    if (left < 8) left = 8;

    // Clamp vertically inside viewport (just in case)
    if (top + rect.height + 8 > vh) top = Math.max(8, vh - rect.height - 8);
    if (top < 8) top = 8;

    tip.style.left = `${left}px`;
    tip.style.top  = `${top}px`;
  }
  function queuePosition(x, y) {
    lastX = x; lastY = y;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { position(lastX, lastY); raf = 0; });
  }

  // Show tooltip for a given target
  function showFor(target, x, y) {
    if (!target) return;
    curTarget = target;
    setContentFrom(target);
    attachObserver(target);
    queuePosition(x, y);
  }

  // Hide tooltip
  function hide() {
    curTarget = null;
    tip.style.display = 'none';
    tip.style.visibility = 'hidden';
    tip.removeAttribute('data-pos');
    detachObserver();
  }

  // Events
  document.addEventListener('pointerover', (e) => {
    const t = findTarget(e.target);
    if (t) {
      showFor(t, e.clientX, e.clientY);
    }
  }, { passive: true });

  document.addEventListener('pointermove', (e) => {
    if (!curTarget) return;
    // If we moved to a different element with/without tooltip, decide
    const t = findTarget(e.target);
    if (t !== curTarget) {
      if (t) {
        showFor(t, e.clientX, e.clientY);
      } else {
        hide();
        return;
      }
    } else {
      queuePosition(e.clientX, e.clientY);
    }
  }, { passive: true });

  document.addEventListener('pointerout', (e) => {
    // Hide only when leaving the whole tooltip-able subtree
    if (!curTarget) return;
    const rel = e.relatedTarget;
    if (!rel || !curTarget.contains(rel)) {
      hide();
    }
  }, { passive: true });

  // Also hide on scroll, blur, or Escape
  window.addEventListener('scroll', hide, { passive: true, capture: true });
  window.addEventListener('blur', hide, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

  // Defensive: hide when clicking anywhere
  document.addEventListener('pointerdown', hide, { passive: true, capture: true });

  // Debug hook
  try { window.__epTooltipVer = 'v7'; console.info(TAG, 'ready v7'); } catch {}
})();
