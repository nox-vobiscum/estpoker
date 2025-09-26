// index-flash.js — shows a one-shot toast on /index after "close room" or "kick" redirects.
// Reuses existing .toast CSS. No inline styles. English code & comments.

(() => {
  'use strict';

  const FLAG_KEY = 'ep-flash'; // set by room.js before redirecting to /
  const flag = sessionStorage.getItem(FLAG_KEY);
  if (!flag) return;
  sessionStorage.removeItem(FLAG_KEY); // one-shot

  const lang = (document.documentElement.lang || 'en').toLowerCase();

  async function fetchMessages(code) {
    try {
      const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(code)}`, {
        credentials: 'same-origin'
      });
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  }

  function show(msg) {
    // Prefer global toast util if present
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, { type: 'info' }); return; } catch {}
    }
    // Minimal fallback using existing .toast class in styles.css
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = msg;
    document.body.appendChild(el);
    // Remove after CSS fadeout; your .toast anims run ~2.8s total
    setTimeout(() => { try { el.remove(); } catch {} }, 3200);
  }

  (async () => {
    const map = await fetchMessages(lang);
    const key = (flag === 'kicked') ? 'flash.kicked' : 'flash.closed';

    // i18n fallbacks in case messages endpoint is unavailable
    const fallbackEn = (flag === 'kicked')
      ? 'The host has kindly asked you to leave.'
      : 'The room was closed by the host.';
    const fallbackDe = (flag === 'kicked')
      ? 'Der Host hat dich freundlich hinausgebeten.'
      : 'Der Raum wurde vom Host geschlossen.';

    const msg = map[key] || (lang.startsWith('de') ? fallbackDe : fallbackEn);
    show(msg);
  })();
})();
