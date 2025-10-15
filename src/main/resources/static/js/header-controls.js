// /static/js/header-controls.js
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

  /* ---------------- Language helpers (header-only) ---------------- */
  const normalizeLang = (l) => (l === "de" || l === "en") ? l : "en";
  const getLang = () => LS.getItem("lang") || root.getAttribute("lang") || "en";
  const setLang = (lang) => {
    const l = normalizeLang(lang);
    LS.setItem("lang", l);
    root.setAttribute("lang", l);
    if (typeof window.setLanguage === "function") {
      try { window.setLanguage(l); } catch (_) {}
    }
    try { window.dispatchEvent(new CustomEvent("est:lang-change", { detail: { lang: l, source: "header" } })); } catch (_) {}
    return l;
  };

  /* ---------------- Reflect UI states ---------------- */
  function reflectThemeUI(mode) {
    const ids = ["hcThemeLight","hcThemeDark","hcThemeSystem"];
    ids.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = `Theme: ${btn.dataset.mode}`;
      btn.setAttribute("aria-label", btn.title);
    });
  }

  function reflectLangUI(lang) {
    const en = document.getElementById("hcLangEN");
    const de = document.getElementById("hcLangDE");
    const isDE = lang === "de";
    if (en) { en.classList.toggle("active", !isDE); en.setAttribute("aria-pressed", !isDE ? "true" : "false"); }
    if (de) { de.classList.toggle("active",  isDE); de.setAttribute("aria-pressed",  isDE ? "true" : "false"); }
    if (en) { en.title = "Language: English"; en.setAttribute("aria-label", en.title); }
    if (de) { de.title = "Sprache: Deutsch";  de.setAttribute("aria-label", de.title); }
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
    const l = normalizeLang(getLang());
    setLang(l);          // persist on first load if needed
    reflectLangUI(l);

    langEN?.addEventListener("click", () => { const v = setLang("en"); reflectLangUI(v); });
    langDE?.addEventListener("click", () => { const v = setLang("de"); reflectLangUI(v); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
