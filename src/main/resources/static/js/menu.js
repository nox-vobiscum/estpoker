/* menu.js v23 — full-row switches + live i18n (no ?lang=), close-button one-line fallback */
(() => {
  'use strict';

  // ---------- Shortcuts ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const overlay   = $('#appMenuOverlay');
  const panel     = overlay ? $('.menu-panel', overlay) : null;
  const btnOpen   = $('#menuButton');
  const btnCloseX = null; // (header close button not used; backdrop handles close)
  const backdrop  = overlay ? $('.menu-backdrop', overlay) : null;

  const rowLang   = $('#langRow');
  const langLabel = $('#langCurrent');
  const flagA     = rowLang ? $('.flag-a', rowLang) : null;
  const flagB     = rowLang ? $('.flag-b', rowLang) : null;

  const rowAuto   = $('#rowAutoReveal');
  const swAuto    = $('#menuAutoRevealToggle');

  const rowTopic  = $('#rowTopic');
  const swTopic   = $('#menuTopicToggle');

  const rowPart   = $('#rowParticipation');
  const swPart    = $('#menuParticipationToggle');

  const closeBtn  = $('#closeRoomBtn');

  // ---------- Menu open/close ----------
  function openMenu() {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    btnOpen?.setAttribute('aria-expanded', 'true');
    panel?.focus?.();

    // Fallbacks in case old CSS is cached:
    //  - force full-row switch layout (grid)
    //  - make close button single-line
    forceRowLayout();
  }

  function closeMenu() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    btnOpen?.setAttribute('aria-expanded', 'false');
    btnOpen?.focus?.();
  }

  btnOpen?.addEventListener('click', openMenu);
  backdrop?.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close')) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) closeMenu();
  });

  // ---------- Helpers ----------
  const getLang = () =>
    (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

  function stripLangParamFromUrl() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.delete('lang');
        history.replaceState({}, '', url.pathname + (url.search ? '?' + url.searchParams.toString() : '') + url.hash);
      }
    } catch {}
  }

  function setLangAttr(code) {
    document.documentElement.lang = code;
  }

  function setFlagsFor(code) {
    if (!flagA || !flagB) return;
    if (code === 'de') {
      flagA.src = '/flags/de.svg'; flagB.src = '/flags/at.svg';
    } else {
      flagA.src = '/flags/us.svg'; flagB.src = '/flags/gb.svg';
    }
  }

  // i18n apply: updates [data-i18n] and [data-i18n-attr] within the whole document
  function applyMessages(map, root = document) {
    // text content
    $$('[data-i18n]', root).forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && map[key] != null) el.textContent = map[key];
    });

    // attribute maps: e.g. data-i18n-attr="aria-label:menu.settings;title:menu.settings"
    $$('[data-i18n-attr]', root).forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr');
      if (!spec) return;
      spec.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s?.trim());
        if (!attr || !key) return;
        const val = map[key];
        if (val != null) el.setAttribute(attr, val);
      });
    });
  }

  async function fetchMessages(code) {
    const url = `/i18n/messages?lang=${encodeURIComponent(code)}`;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`i18n HTTP ${res.status}`);
    return res.json();
  }

  async function switchLanguage(to) {
    try {
      // Update html[lang] + flags + label immediately (optimistic)
      setLangAttr(to);
      setFlagsFor(to);
      if (langLabel) langLabel.textContent = (to === 'de') ? 'Deutsch' : 'English';

      // Fetch and apply catalog without reload
      const messages = await fetchMessages(to);
      applyMessages(messages, document);

      // Remove ?lang=… from URL to avoid confusion
      stripLangParamFromUrl();
    } catch (err) {
      // If fetching fails, at least ensure UI stays consistent
      console.warn('[i18n] switch failed:', err);
      stripLangParamFromUrl();
    }
  }

  // Language row toggles between en <-> de
  rowLang?.addEventListener('click', () => {
    const next = getLang() === 'de' ? 'en' : 'de';
    switchLanguage(next);
  });

  // ---------- Full-row switch wiring ----------
  function wireSwitchRow(rowEl, inputEl, onChange) {
    if (!rowEl || !inputEl) return;

    // Click anywhere on row toggles the switch (if enabled)
    rowEl.addEventListener('click', (e) => {
      if (e.target === inputEl || e.target.closest('input') === inputEl) return;
      if (inputEl.disabled) return;
      inputEl.checked = !inputEl.checked;
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Change handler → emit custom events expected by room.js
    inputEl.addEventListener('change', () => {
      const on = !!inputEl.checked;
      onChange?.(on);
    });
  }

  // Wire three rows
  wireSwitchRow(rowAuto,  swAuto,  (on) => document.dispatchEvent(new CustomEvent('ep:auto-reveal-toggle', { detail: { on } })));
  wireSwitchRow(rowTopic, swTopic, (on) => document.dispatchEvent(new CustomEvent('ep:topic-toggle',       { detail: { on } })));
  wireSwitchRow(rowPart,  swPart,  (on) => document.dispatchEvent(new CustomEvent('ep:participation-toggle',{ detail: { estimating: on } })));

  // Close room button → emit event (room.js will confirm + send)
  closeBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('ep:close-room'));
  });

  // ---------- Visual fallbacks (force layout even with stale CSS) ----------
  function forceRowLayout() {
    // Ensure switch rows are grids with three columns
    $$('.menu-item.switch').forEach((row) => {
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '28px 1fr max-content';
      row.style.alignItems = 'center';
    });

    // Make the danger CTA one-line with icon + text
    if (closeBtn) {
      closeBtn.style.display = 'grid';
      closeBtn.style.gridTemplateColumns = '28px 1fr';
      const text = $('.truncate-1', closeBtn);
      if (text) {
        text.style.whiteSpace = 'nowrap';
        text.style.overflow = 'hidden';
        text.style.textOverflow = 'ellipsis';
      }
    }
  }

  // ---------- Init ----------
  (function init() {
    // Align language visuals to current document lang
    const lang = getLang();
    setFlagsFor(lang);
    if (langLabel) langLabel.textContent = (lang === 'de') ? 'Deutsch' : 'English';

    // If the page was opened with ?lang=…, drop it (we're fully dynamic now)
    stripLangParamFromUrl();

    // If menu opens immediately (e.g., deep link), make sure layout is forced
    // (We also call this again in openMenu())
    forceRowLayout();
  })();
})();
