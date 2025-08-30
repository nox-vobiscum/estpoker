// /static/js/menu.js  (v14)
// central menu + theme + language + i18n runtime + sequence + guarded toggles
(function () {
  if (window.__epMenuInit) return;
  window.__epMenuInit = true;

  const doc = document;
  const DEBUG = (function () {
    try {
      return localStorage.getItem('ep.debug') === '1' || location.search.includes('ep.debug=1');
    } catch { return false; }
  })();

  // ---------------- i18n runtime ----------------
  window.__epI18n = window.__epI18n || (function () {
    const cache = new Map();
    let lang = (document.documentElement.lang || "en").toLowerCase();
    let catalog = null;

    const norm = l => (String(l || "en").toLowerCase().split("-")[0]);

    async function load(nextLang) {
      const target = norm(nextLang);
      if (catalog && lang === target) return catalog;
      if (cache.has(target)) { lang = target; catalog = cache.get(target); return catalog; }
      const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(target)}`, { credentials: "same-origin" });
      const json = await res.json();
      cache.set(target, json);
      lang = target; catalog = json;
      try { fetch(`/i18n?lang=${encodeURIComponent(target)}`, { credentials: "same-origin", redirect: "manual" }); } catch {}
      return catalog;
    }

    function t(key, fallback){
      if (catalog && Object.prototype.hasOwnProperty.call(catalog, key)) return String(catalog[key]);
      return fallback != null ? String(fallback) : key;
    }

    function apply(root){
      const r = root || document;
      r.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n"); if (!key) return;
        el.textContent = t(key, el.textContent);
      });
      r.querySelectorAll("[data-i18n-attr]").forEach(el => {
        const spec = el.getAttribute("data-i18n-attr"); if (!spec) return;
        spec.split(";").forEach(pair => {
          const [attr,k] = pair.split(":").map(s => s && s.trim());
          if (!attr || !k) return;
          el.setAttribute(attr, t(k, el.getAttribute(attr)));
        });
      });
      // allow a second attr-batch (used above)
      r.querySelectorAll("[data-i18n-attr-2]").forEach(el => {
        const spec = el.getAttribute("data-i18n-attr-2"); if (!spec) return;
        spec.split(";").forEach(pair => {
          const [attr,k] = pair.split(":").map(s => s && s.trim());
          if (!attr || !k) return;
          el.setAttribute(attr, t(k, el.getAttribute(attr)));
        });
      });

      document.documentElement.setAttribute("lang", lang);
      try { document.dispatchEvent(new CustomEvent("ep:lang-changed", { detail: { lang, catalog } })); } catch {}
    }

    return { load, apply, t,
      get lang(){ return lang; },
      get catalog(){ return catalog; }
    };
  })();

  // ---------------- helpers ----------------
  const isDe = () => (window.__epI18n?.lang || document.documentElement.lang || "en").toLowerCase().startsWith("de");
  function setNiceTooltip(el, text){ if (!el) return; if (text) el.setAttribute("data-tooltip", text); else el.removeAttribute("data-tooltip"); el.removeAttribute("title"); }
  function qs(id){ return document.getElementById(id); }

  // ---------------- menu open/close ----------------
  let btn, overlay, panel, backdrop, lastFocus = null;

  function focusables(){
    return panel?.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') || [];
  }
  function trapTab(e){
    if (e.key !== "Tab" || overlay.classList.contains("hidden")) return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length-1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
  function openMenu(){
    if (!overlay || !btn) return;
    document.body.classList.add("menu-open");
    window.__epTooltipHide && window.__epTooltipHide();
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden","false");
    btn.classList.add("open");
    btn.setAttribute("aria-expanded","true");
    btn.setAttribute("aria-label", window.__epI18n?.t("menu.close","Close menu"));
    btn.textContent = "✕";
    lastFocus = document.activeElement;
    setTimeout(() => focusables()[0]?.focus(), 0);
    window.addEventListener("keydown", trapTab);
  }
  function closeMenu(){
    if (!overlay || !btn) return;
    document.body.classList.remove("menu-open");
    window.__epTooltipHide && window.__epTooltipHide();
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden","true");
    btn.classList.remove("open");
    btn.setAttribute("aria-expanded","false");
    btn.setAttribute("aria-label", window.__epI18n?.t("menu.open","Open menu"));
    btn.textContent = "☰";
    window.removeEventListener("keydown", trapTab);
    lastFocus?.focus();
  }
  function toggleMenu(){ overlay && (overlay.classList.contains("hidden") ? openMenu() : closeMenu()); }

  // ---------------- theme ----------------
  let bLight, bDark, bSystem;
  function applyTheme(t){
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("estpoker-theme", t); } catch {}
    [bLight,bDark,bSystem].forEach(x=>x&&x.classList.remove("active"));
    ({light:bLight, dark:bDark, system:bSystem}[t||"dark"])?.classList.add("active");
    [bLight,bDark,bSystem].forEach(x=>x&&x.setAttribute("aria-pressed","false"));
    ({light:bLight, dark:bDark, system:bSystem}[t||"dark"])?.setAttribute("aria-pressed","true");
  }

  // ---------------- language switch ----------------
  let langRow, langLbl, flagA, flagB;
  function setSplit(l){
    if (!flagA || !flagB) return;
    if (String(l).toLowerCase().startsWith("de")) {
      flagA.src="/flags/de.svg"; flagB.src="/flags/at.svg"; if (langLbl) langLbl.textContent = "Deutsch";
    } else {
      flagA.src="/flags/us.svg"; flagB.src="/flags/gb.svg"; if (langLbl) langLbl.textContent = "English";
    }
  }
  async function switchLangDynamic(to){
    try{
      await window.__epI18n.load(to);
      window.__epI18n.apply(document);
      setSplit(to);
      const tipLight  = window.__epI18n.t("title.theme.light",  overlay?.dataset.tipThemeLight  || "Theme: Light");
      const tipDark   = window.__epI18n.t("title.theme.dark",   overlay?.dataset.tipThemeDark   || "Theme: Dark");
      const tipSystem = window.__epI18n.t("title.theme.system", overlay?.dataset.tipThemeSystem || "Theme: System");
      setNiceTooltip(bLight, tipLight); setNiceTooltip(bDark, tipDark); setNiceTooltip(bSystem, tipSystem);

      const toLabel = String(to).toLowerCase().startsWith("de") ? "Deutsch" : "English";
      const tpl = window.__epI18n.t("title.lang.to", overlay?.dataset.tipLangTo || "Switch language → {0}");
      setNiceTooltip(langRow, tpl.replace("{0}", toLabel));

      // refresh sequence tooltips after language switch
      applySeqTooltips();
    }catch(e){ console.warn("[MENU] lang switch failed", e); }
  }

  // ---------------- one-time binder ----------------
  let bound = false;

  function applySeqTooltips(){
    const root = doc.getElementById("menuSeqChoice");
    if (!root) return;
    root.querySelectorAll("label.radio-row").forEach(label => {
      const key = label.getAttribute("data-seq");
      if (!key) return;
      const txt = window.__epI18n.t(`seq.tooltip.${key}`, label.getAttribute("data-tooltip") || "");
      setNiceTooltip(label, txt);
    });
  }

  function setRowDisabled(inputEl, disabled, tooltipKey){
    if (!inputEl) return;
    inputEl.disabled = !!disabled;
    const row = inputEl.closest('.menu-item.switch');
    if (row){
      row.classList.toggle('disabled', !!disabled);
      const txt = disabled ? window.__epI18n.t(tooltipKey, "Only the host can change this setting") : "";
      if (disabled) setNiceTooltip(row, txt); else { row.removeAttribute("data-tooltip"); }
      row.setAttribute("aria-disabled", String(!!disabled));
    }
  }

  function bindMenu(){
    if (bound) return true;

    const savedTheme = (function(){ try { return localStorage.getItem("estpoker-theme") || "dark"; } catch { return "dark"; } })();

    btn      = qs("menuButton");
    overlay  = qs("appMenuOverlay");
    panel    = overlay?.querySelector(".menu-panel");
    backdrop = overlay?.querySelector("[data-close]");
    if (!btn || !overlay) return false;

    if (!btn.__epWired) { btn.addEventListener("click", toggleMenu, { passive:true }); btn.__epWired = true; }
    backdrop?.addEventListener("click", closeMenu);
    window.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeMenu(); });

    // Theme
    bLight  = qs("themeLight");
    bDark   = qs("themeDark");
    bSystem = qs("themeSystem");
    ({light:bLight, dark:bDark, system:bSystem}[savedTheme])?.classList.add("active");
    ({light:bLight, dark:bDark, system:bSystem}[savedTheme])?.setAttribute("aria-pressed","true");
    const tipLight  = overlay?.dataset.tipThemeLight  || "Theme: Light";
    const tipDark   = overlay?.dataset.tipThemeDark   || "Theme: Dark";
    const tipSystem = overlay?.dataset.tipThemeSystem || "Theme: System";
    setNiceTooltip(bLight, tipLight); setNiceTooltip(bDark, tipDark); setNiceTooltip(bSystem, tipSystem);
    bLight?.addEventListener("click",  ()=>applyTheme("light"));
    bDark?.addEventListener("click",   ()=>applyTheme("dark"));
    bSystem?.addEventListener("click", ()=>applyTheme("system"));

    // Language row
    langRow = qs("langRow");
    langLbl = qs("langCurrent");
    flagA = langRow?.querySelector(".flag-a");
    flagB = langRow?.querySelector(".flag-b");
    if (langRow) {
      setSplit(window.__epI18n?.lang || document.documentElement.lang || "en");
      const to  = (isDe() ? "en" : "de");
      const tip = (overlay?.dataset.tipLangTo || "Switch language → {0}").replace("{0}", to === "de" ? "Deutsch" : "English");
      setNiceTooltip(langRow, tip);
      langRow.addEventListener("click", () => {
        const target = isDe() ? "en" : "de";
        switchLangDynamic(target);
      });
      if (!langRow.hasAttribute('tabindex')) langRow.setAttribute('tabindex','0');
      langRow.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); langRow.click(); }
      });
    }

    // Sequence radios -> event to app
    const seqRoot = qs("menuSeqChoice");
    if (seqRoot) {
      seqRoot.addEventListener("change", (e) => {
        const r = e.target;
        if (!r || r.type !== "radio" || r.name !== "menu-seq") return;
        const id = r.value;
        if (DEBUG) console.debug('[menu] ep:sequence-change', { id });
        try { document.dispatchEvent(new CustomEvent("ep:sequence-change", { detail: { id } })); } catch {}
      });
      applySeqTooltips();
    }

    // ----- the three switches -----
    const ar   = qs("menuAutoRevealToggle");
    const top  = qs("menuTopicToggle");
    const part = qs("menuParticipationToggle");
    const arLabel   = qs("menuArStatus");
    const topicLbl  = qs("menuTopicStatus");
    const partLbl   = qs("menuPartStatus");

    function onAR(e){
      if (ar.disabled) return;
      const on = !!e.target.checked;
      e.target.setAttribute("aria-checked", String(on));
      if (arLabel) arLabel.textContent = on ? (isDe() ? "An" : "On") : (isDe() ? "Aus" : "Off");
      if (DEBUG) console.debug('[menu] ep:auto-reveal-toggle', { on });
      try { document.dispatchEvent(new CustomEvent("ep:auto-reveal-toggle", { detail: { on } })); } catch {}
    }
    function onTopic(e){
      if (top.disabled) return;
      const on = !!e.target.checked;
      e.target.setAttribute("aria-checked", String(on));
      if (topicLbl) topicLbl.textContent = on ? (isDe() ? "An" : "On") : (isDe() ? "Aus" : "Off");
      if (DEBUG) console.debug('[menu] ep:topic-toggle', { on });
      try { document.dispatchEvent(new CustomEvent("ep:topic-toggle", { detail: { on } })); } catch {}
    }
    function onPart(e){
      const estimating = !!e.target.checked;
      e.target.setAttribute("aria-checked", String(estimating));
      if (partLbl) partLbl.textContent = estimating ? (isDe() ? "Ich schätze mit" : "I'm estimating")
                                                    : (isDe() ? "Beobachter:in" : "Observer");
      if (DEBUG) console.debug('[menu] ep:participation-toggle', { estimating });
      try { document.dispatchEvent(new CustomEvent("ep:participation-toggle", { detail: { estimating } })); } catch {}
    }
    ar?.addEventListener("change", onAR);
    top?.addEventListener("change", onTopic);
    part?.addEventListener("change", onPart);

    // NEW: whole-row interaction (but not when disabled)
    function bindRowToggleFor(inputEl, changeHandler){
      if (!inputEl) return;
      const row = inputEl.closest('.menu-item.switch');
      if (!row) return;
      if (!row.hasAttribute('tabindex')) row.setAttribute('tabindex','0');
      row.addEventListener('click', (ev) => {
        if (inputEl.disabled) return;
        if (ev.target === inputEl) return;
        if (ev.target && ev.target.closest('input,button,a,label')) return;
        inputEl.checked = !inputEl.checked;
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      });
      row.addEventListener('keydown', (ev) => {
        if (inputEl.disabled) return;
        if (ev.key === ' ' || ev.key === 'Enter') {
          ev.preventDefault();
          inputEl.checked = !inputEl.checked;
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
    bindRowToggleFor(ar, onAR);
    bindRowToggleFor(top, onTopic);
    bindRowToggleFor(part, onPart);

    // Close room
    const closeBtn = qs("closeRoomBtn");
    if (closeBtn) {
      setNiceTooltip(closeBtn, window.__epI18n?.t("room.close.hint","Closes this room for all participants and returns to the start page."));
      closeBtn.addEventListener("click", () => {
        if (DEBUG) console.debug('[menu] ep:close-room');
        try { document.dispatchEvent(new CustomEvent("ep:close-room")); } catch {}
        closeMenu();
      });
    }

    bound = true;
    return true;
  }

  if (!bindMenu()) {
    document.addEventListener("DOMContentLoaded", bindMenu, { once:true });
  }

  // -------- public API for room.js to sync host/guest disable state --------
  function syncTogglesHostState(isHost){
    const ar  = document.getElementById("menuAutoRevealToggle");
    const top = document.getElementById("menuTopicToggle");
    setRowDisabled(ar,  !isHost, "autoreveal.onlyHost");
    setRowDisabled(top, !isHost, "autoreveal.onlyHost");
  }
  window.__epMenuSyncHost = syncTogglesHostState;

  // expose nice-tooltip util as before
  window.__setNiceTooltip = setNiceTooltip;
})();
