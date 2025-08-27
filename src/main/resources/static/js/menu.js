// /static/js/menu.js — central menu + theme + language + i18n runtime + sequence dispatch
(function () {
  // Avoid double-binding if script is injected more than once.
  if (window.__epMenuInit) return;
  window.__epMenuInit = true;

  const doc = document;
  let btn, overlay, panel, backdrop;

  /* ---------------- lightweight i18n runtime ---------------- */
  window.__epI18n = window.__epI18n || (function () {
    const cache = new Map();
    let lang = (document.documentElement.lang || "en").toLowerCase();
    let catalog = null;

    function norm(l){ return (l || "en").toLowerCase().split("-")[0]; }

    async function load(nextLang){
      const target = norm(nextLang);
      if (catalog && lang === target) return catalog;
      if (cache.has(target)) { lang = target; catalog = cache.get(target); return catalog; }
      const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(target)}`, { credentials: "same-origin" });
      const json = await res.json();
      cache.set(target, json);
      lang = target; catalog = json;
      // also set session locale (ignore redirect)
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
      document.documentElement.setAttribute("lang", lang);
      try { document.dispatchEvent(new CustomEvent("ep:lang-changed", { detail: { lang, catalog } })); } catch {}
    }

    return { load, apply, t, get lang(){ return lang; }, get catalog(){ return catalog; } };
  })();

  /* ---------------- tooltip helper ---------------- */
  function setNiceTooltip(el, text){
    if (!el) return;
    if (text) el.setAttribute("data-tooltip", text);
    else el.removeAttribute("data-tooltip");
    el.removeAttribute("title");
  }

  /* ---------------- menu open/close + focus trap ---------------- */
  let lastFocus = null;

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
  function isOpen(){ return overlay && !overlay.classList.contains("hidden"); }

  function openMenu(){
    if (!overlay || !btn) return;
    document.body.classList.add("menu-open");
    window.__epTooltipHide && window.__epTooltipHide();
    overlay.classList.remove("hidden");
    btn.classList.add("open");
    btn.setAttribute("aria-expanded","true");
    btn.setAttribute("aria-label","Close menu");
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
    btn.classList.remove("open");
    btn.setAttribute("aria-expanded","false");
    btn.setAttribute("aria-label","Open menu");
    btn.textContent = "☰";
    window.removeEventListener("keydown", trapTab);
    lastFocus?.focus();
  }
  function toggleMenu(){ isOpen() ? closeMenu() : openMenu(); }

  /* ---------------- theme ---------------- */
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

  /* ---------------- language switch ---------------- */
  let langRow, langLbl, flagA, flagB;
  const isDe = l => String(l||"").toLowerCase().startsWith("de");
  const labelFor = l => isDe(l) ? "Deutsch" : "English";
  function setSplit(l){
    if (!flagA || !flagB) return;
    if (isDe(l)) { flagA.src="/flags/de.svg"; flagB.src="/flags/at.svg"; if (langLbl) langLbl.textContent="Deutsch"; }
    else { flagA.src="/flags/us.svg"; flagB.src="/flags/gb.svg"; if (langLbl) langLbl.textContent="English"; }
  }
  function nextLang(cur){ return isDe(cur) ? "en" : "de"; }

  async function switchLangDynamic(to){
    try{
      await window.__epI18n.load(to);
      window.__epI18n.apply(document);
      setSplit(to);
      const tipLight  = window.__epI18n.t("title.theme.light",  overlay?.dataset.tipThemeLight  || "Theme: Light");
      const tipDark   = window.__epI18n.t("title.theme.dark",   overlay?.dataset.tipThemeDark   || "Theme: Dark");
      const tipSystem = window.__epI18n.t("title.theme.system", overlay?.dataset.tipThemeSystem || "Theme: System");
      setNiceTooltip(bLight, tipLight);
      setNiceTooltip(bDark,  tipDark);
      setNiceTooltip(bSystem, tipSystem);
      const toLabel = labelFor(to);
      const tpl = window.__epI18n.t("title.lang.to", overlay?.dataset.tipLangTo || "Switch language → {0}");
      setNiceTooltip(langRow, tpl.replace("{0}", toLabel));
    }catch {}
  }

  function wireSequencePicker(){
    const root = doc.getElementById("menuSeqChoice");
    if (!root) return;
    root.addEventListener("change", (e) => {
      const r = e.target;
      if (!r || r.type !== "radio" || r.name !== "menu-seq") return;
      const id = r.value;
      try { document.dispatchEvent(new CustomEvent("ep:sequence-change", { detail: { id } })); } catch {}
    });
  }

  /* ---------------- one-time binder ---------------- */
  let bound = false;
  function bindMenu(){
    if (bound) return true;

    btn      = doc.getElementById("menuButton");
    overlay  = doc.getElementById("appMenuOverlay");
    panel    = overlay?.querySelector(".menu-panel");
    backdrop = overlay?.querySelector("[data-close]");

    if (!btn || !overlay) return false;

    // Bind click safely (avoid duplicates).
    if (!btn.__epWired) {
      btn.addEventListener("click", toggleMenu, { passive: true });
      btn.__epWired = true;
    }
    backdrop?.addEventListener("click", closeMenu);
    window.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeMenu(); });

    // Theme wiring + initial visuals
    bLight  = doc.getElementById("themeLight");
    bDark   = doc.getElementById("themeDark");
    bSystem = doc.getElementById("themeSystem");
    const saved = localStorage.getItem("estpoker-theme") || "dark";
    ({light:bLight, dark:bDark, system:bSystem}[saved])?.classList.add("active");
    ({light:bLight, dark:bDark, system:bSystem}[saved])?.setAttribute("aria-pressed","true");

    const tipLight  = overlay?.dataset.tipThemeLight  || "Theme: Light";
    const tipDark   = overlay?.dataset.tipThemeDark   || "Theme: Dark";
    const tipSystem = overlay?.dataset.tipThemeSystem || "Theme: System";
    setNiceTooltip(bLight,  tipLight);
    setNiceTooltip(bDark,   tipDark);
    setNiceTooltip(bSystem, tipSystem);

    bLight?.addEventListener("click",  ()=>applyTheme("light"));
    bDark?.addEventListener("click",   ()=>applyTheme("dark"));
    bSystem?.addEventListener("click", ()=>applyTheme("system"));

    // Language row
    langRow = doc.getElementById("langRow");
    langLbl = doc.getElementById("langCurrent");
    flagA = langRow?.querySelector(".flag-a");
    flagB = langRow?.querySelector(".flag-b");
    if (langRow) {
      const cur = (document.documentElement.lang || "en");
      setSplit(cur);
      const to  = nextLang(cur);
      const tip = (overlay?.dataset.tipLangTo || "Switch language → {0}").replace("{0}", labelFor(to));
      setNiceTooltip(langRow, tip);
      langRow.addEventListener("click", ()=>switchLangDynamic(nextLang(document.documentElement.lang || "en")));
    }

    // Sequence radios
    wireSequencePicker();

    // Close-room relay
    const closeBtn = doc.getElementById("closeRoomBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", ()=>{
        document.dispatchEvent(new CustomEvent("ep:close-room"));
        closeMenu();
      });
    }

    bound = true;
    return true;
  }

  if (!bindMenu()) {
    // Bind once DOM is fully parsed (safe when placed in <head> or <body>).
    document.addEventListener("DOMContentLoaded", bindMenu, { once: true });
  }

  // Expose helper (optional external reuse)
  window.__setNiceTooltip = setNiceTooltip;
})();
