// /static/js/header-controls.js  (v7 - robust i18n apply)
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
    try { window.dispatchEvent(new CustomEvent("est:theme-change", { detail: { mode: m, source: "header" } })); } catch {}
  };

  /* ---------------- Language helpers ---------------- */
  const norm = (l) => (l === "de" || l === "en") ? l : "en";
  const getLang = () => norm(LS.getItem("lang") || root.getAttribute("lang") || "en");

  // format "Hello {0}" / "Hi {name}"
  function fmt(str, params) {
    if (!str || !params) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => {
      if (Object.prototype.hasOwnProperty.call(params, k)) return params[k];
      const i = Number(k);
      return Number.isFinite(i) && params[i] != null ? params[i] : `{${k}}`;
    });
  }

  // Apply i18n maps to the page (static + attr + dynamic)
  function applyI18nMap(map) {
    if (!map) return;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (key && map[key] != null) el.textContent = map[key];
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(el => {
      const spec = el.getAttribute("data-i18n-attr") || "";
      spec.split(";").forEach(pair => {
        const [attr, key] = pair.split(":").map(s => s?.trim());
        if (attr && key && map[key] != null) el.setAttribute(attr, map[key]);
      });
    });
    document.querySelectorAll("[data-i18n-dyn]").forEach(el => {
      const key = el.getAttribute("data-i18n-dyn");
      const tmpl = key ? map[key] : null;
      if (!tmpl) return;
      const params = {};
      Object.entries(el.dataset).forEach(([k, v]) => {
        if (/^arg\d+$/.test(k)) params[Number(k.slice(3))] = v;
        else if (k !== "i18nDyn") params[k] = v;
      });
      el.innerHTML = fmt(tmpl, params);
    });
  }

  // Always performs the full language switch + local i18n apply.
  async function setLang(lang) {
    const l = norm(lang);
    // Persist + reflect
    LS.setItem("lang", l);
    root.setAttribute("lang", l);

    // Call menu bridge if present (no harm if also doing local apply)
    try { typeof window.setLanguage === "function" && window.setLanguage(l); } catch {}

    // ALWAYS fetch & apply locally – this makes header self-sufficient
    try {
      const res = await fetch(`/i18n/messages?lang=${encodeURIComponent(l)}`, { credentials: "same-origin" });
      if (res.ok) applyI18nMap(await res.json());
    } catch {}

    // Notify other listeners (room.js, etc.)
    try { window.dispatchEvent(new CustomEvent("est:lang-change", { detail: { lang: l, source: "header" } })); } catch {}
    return l;
  }

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
    ["hcThemeLight","hcThemeDark","hcThemeSystem"].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (!btn.dataset.mode) {
        btn.dataset.mode = id.endsWith("Light") ? "light" : id.endsWith("Dark") ? "dark" : "system";
      }
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = `Theme: ${btn.dataset.mode}`;
      btn.setAttribute("aria-label", btn.title);
    });
  }

  function reflectLangUI(lang) {
    const isDE = lang === "de";
    const enBtn = document.getElementById("hcLangEN");
    const deBtn = document.getElementById("hcLangDE");
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

    // Theme current + listeners
    const t = getTheme();
    applyTheme(t);
    reflectThemeUI(t);
    themeLight?.addEventListener("click",  () => { applyTheme("light");  reflectThemeUI("light");  });
    themeDark?.addEventListener("click",   () => { applyTheme("dark");   reflectThemeUI("dark");   });
    themeSystem?.addEventListener("click", () => { applyTheme("system"); reflectThemeUI("system"); });

    // Language current + listeners
    const l = getLang();
    setLang(l);           // align LS/html and apply i18n on first load
    reflectLangUI(l);
    langEN?.addEventListener("click", async () => { const cur = getLang(); if (cur !== "en") reflectLangUI(await setLang("en")); });
    langDE?.addEventListener("click", async () => { const cur = getLang(); if (cur !== "de") reflectLangUI(await setLang("de")); });

    // keep in sync if others change it
    window.addEventListener("est:lang-change", (e) => {
      try { reflectLangUI(norm(e?.detail?.lang || e?.detail?.to || getLang())); } catch {}
    });
    window.addEventListener("est:theme-change", (e) => {
      try { reflectThemeUI(e?.detail?.mode || getTheme()); } catch {}
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
