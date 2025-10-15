// /static/js/header-controls.js  (v6 with safe i18n fallback)
(function () {
  const root = document.documentElement;
  const LS = window.localStorage;

  /* ---------------- Theme helpers ---------------- */
  const getTheme = () => LS.getItem("theme") || LS.getItem("themeMode") || "system";
  const setThemeLS = (mode) => { LS.setItem("theme", mode); LS.setItem("themeMode", mode); };
  const applyTheme = (mode) => {
    const m = ["light", "dark", "system"].includes(mode) ? mode : "system";
    if (m === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", m);
    setThemeLS(m);
    try { window.dispatchEvent(new CustomEvent("est:theme-change", { detail: { mode: m, source: "header" } })); } catch (_) {}
  };

  /* ---------------- Language helpers ---------------- */
  const normalizeLang = (l) => (l === "de" || l === "en") ? l : "en";
  const getLang = () => normalizeLang(LS.getItem("lang") || root.getAttribute("lang") || "en");

  // Minimal i18n apply/fallback (used only if menu.js bridge is missing)
  async function fallbackApplyI18n(lang) {
    try {
      const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(lang)}`, { credentials: "same-origin" });
      if (!res.ok) return;
      const map = await res.json();

      // apply [data-i18n]
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (key && map[key] != null) el.textContent = map[key];
      });
      // apply [data-i18n-attr]="title:foo;aria-label:bar"
      document.querySelectorAll("[data-i18n-attr]").forEach(el => {
        const spec = el.getAttribute("data-i18n-attr") || "";
        spec.split(";").forEach(pair => {
          const [attr, key] = pair.split(":").map(s => s?.trim());
          if (attr && key && map[key] != null) el.setAttribute(attr, map[key]);
        });
      });
    } catch (_) {/* silent */}
  }

  // Set LS + <html lang>, then route via central API if available; else emit & fallback.
  const setLang = async (lang) => {
    const l = normalizeLang(lang);
    LS.setItem("lang", l);
    root.setAttribute("lang", l);

    if (typeof window.setLanguage === "function") {
      try { window.setLanguage(l); } catch (_) {}
    } else {
      try { window.dispatchEvent(new CustomEvent("est:lang-change", { detail: { lang: l, source: "header" } })); } catch (_) {}
      // robust fallback so prod still updates even if menu.js is old
      await fallbackApplyI18n(l);
    }
    return l;
  };

  /* ---------------- Flag helpers ---------------- */
  function setFlagPair(containerEl, lang) {
    if (!containerEl) return;
    const a = containerEl.querySelector(".flag-a");
    const b = containerEl.querySelector(".flag-b");
    const pair = (lang === "de") ? ["de", "at"] : ["us", "gb"];
    if (a) { a.src = `/flags/${pair[0]}.svg`; a.alt = ""; }
    if (b) { b.src = `/flags/${pair[1]}.svg`; b.alt = ""; }
  }

  /* ---------------- Reflect UI states ---------------- */
  function reflectThemeUI(mode) {
    const ids = ["hcThemeLight","hcThemeDark","hcThemeSystem"];
    ids.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (!btn.dataset.mode) {
        if (id.endsWith("Light")) btn.dataset.mode = "light";
        else if (id.endsWith("Dark")) btn.dataset.mode = "dark";
        else btn.dataset.mode = "system";
      }
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = `Theme: ${btn.dataset.mode}`;
      btn.setAttribute("aria-label", btn.title);
    });
  }

  function reflectLangUI(lang) {
    const enBtn = document.getElementById("hcLangEN");
    const deBtn = document.getElementById("hcLangDE");
    const isDE = lang === "de";

    if (enBtn) {
      setFlagPair(enBtn, "en");
      enBtn.classList.toggle("active", !isDE);
      enBtn.setAttribute("aria-pressed", !isDE ? "true" : "false");
      enBtn.title = "Language: English";
      enBtn.setAttribute("aria-label", enBtn.title);
    }
    if (deBtn) {
      setFlagPair(deBtn, "de");
      deBtn.classList.toggle("active", isDE);
      deBtn.setAttribute("aria-pressed", isDE ? "true" : "false");
      deBtn.title = "Language: German";
      deBtn.setAttribute("aria-label", deBtn.title);
    }
  }

  /* ---------------- Init & events ---------------- */
  function init() {
    const themeLight  = document.getElementById("hcThemeLight");
    const themeDark   = document.getElementById("hcThemeDark");
    const themeSystem = document.getElementById("hcThemeSystem");

    const langEN = document.getElementById("hcLangEN");
    const langDE = document.getElementById("hcLangDE");

    // Theme: set current + listeners
    const t = getTheme();
    applyTheme(t);
    reflectThemeUI(t);

    themeLight?.addEventListener("click",  () => { applyTheme("light");  reflectThemeUI("light");  });
    themeDark?.addEventListener("click",   () => { applyTheme("dark");   reflectThemeUI("dark");   });
    themeSystem?.addEventListener("click", () => { applyTheme("system"); reflectThemeUI("system"); });

    // Language: set current + listeners
    const l = getLang();
    // persist/align on first load (and trigger menu.js if present)
    setLang(l);
    reflectLangUI(l);

    langEN?.addEventListener("click", async () => {
      const cur = getLang();
      if (cur !== "en") reflectLangUI(await setLang("en"));
    });
    langDE?.addEventListener("click", async () => {
      const cur = getLang();
      if (cur !== "de") reflectLangUI(await setLang("de"));
    });

    // Stay in sync if menu.js (or others) change things
    window.addEventListener("est:lang-change", (e) => {
      try {
        const next = normalizeLang(e?.detail?.lang || e?.detail?.to || getLang());
        reflectLangUI(next);
      } catch (_) {}
    });
    window.addEventListener("est:theme-change", (e) => {
      try {
        const next = (e?.detail?.mode) || getTheme();
        reflectThemeUI(next);
      } catch (_) {}
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
