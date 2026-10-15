// One owner for presentation preferences; dialog and game state are deliberately absent.
(() => {
  'use strict';
  const root = document.documentElement;
  const normalizeLang = value => String(value || '').toLowerCase().startsWith('de') ? 'de' : 'en';
  const state = {
    themeMode: window.PPStorage.theme() || 'system',
    language: normalizeLang(window.PPStorage.read('localStorage', 'lang') || root.lang || 'en')
  };
  const listeners = new Set();
  let messages = Object.create(null);
  let languageGeneration = 0;
  let loadedLanguage = null;
  let pendingLanguage = null;
  const snapshot = () => Object.freeze({ ...state });
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const publish = () => {
    const current = snapshot();
    listeners.forEach(listener => {
      try { listener(current); } catch (error) { console.warn('[preferences] view failed', error); }
    });
  };
  const applyRoot = () => {
    if (state.themeMode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.themeMode);
    if (root.lang !== state.language) root.lang = state.language;
  };
  function setTheme(mode) {
    if (!['light', 'dark', 'system'].includes(mode)) mode = 'system';
    state.themeMode = mode;
    write('planningpoker-theme', mode);
    applyRoot();
    publish();
  }
  function message(key, fallback, params) {
    const text = messages[key] ?? fallback;
    if (!params || text == null) return text;
    return String(text).replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match);
  }
  function applyMessages() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const value = messages[el.getAttribute('data-i18n')];
      if (value != null) el.textContent = value;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      (el.getAttribute('data-i18n-attr') || '').split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(part => part.trim());
        if (attr && messages[key] != null) el.setAttribute(attr, messages[key]);
      });
    });
    document.querySelectorAll('[data-i18n-dyn]').forEach(el => {
      const key = el.getAttribute('data-i18n-dyn');
      if (messages[key] == null) return;
      const params = {};
      Object.entries(el.dataset).forEach(([name, value]) => {
        if (/^arg\d+$/.test(name)) params[Number(name.slice(3))] = value;
        else if (name !== 'i18nDyn') params[name] = value;
      });
      el.innerHTML = message(key, '', params);
    });
  }
  function stripLangParam() {
    const url = new URL(location.href);
    if (!url.searchParams.has('lang')) return;
    url.searchParams.delete('lang');
    history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
  function setLanguage(value, source = 'header') {
    const code = normalizeLang(value);
    if (code === state.language && loadedLanguage === code) return Promise.resolve(code);
    if (code === state.language && pendingLanguage) return pendingLanguage;
    state.language = code;
    write('lang', code);
    applyRoot();
    publish();
    const generation = ++languageGeneration;
    const task = (async () => {
      try {
        const response = await fetch('/i18n/messages?lang=' + encodeURIComponent(code), { credentials: 'same-origin' });
        if (!response.ok) throw new Error('i18n HTTP ' + response.status);
        const map = await response.json();
        if (generation !== languageGeneration) return code;
        messages = map;
        loadedLanguage = code;
        applyMessages();
      } catch (error) {
        if (generation !== languageGeneration) return code;
        console.warn('[preferences] language load failed', error);
      }
      if (generation !== languageGeneration) return code;
      stripLangParam();
      publish();
      // Preserve the established event names, targets and payload shape.
      if (source !== 'init') {
        const detail = { lang: code, source };
        window.dispatchEvent(new CustomEvent('pp:lang-change', { detail }));
        document.dispatchEvent(new CustomEvent('pp:lang-changed', { detail }));
      }
      return code;
    })();
    pendingLanguage = task;
    task.finally(() => { if (pendingLanguage === task) pendingLanguage = null; });
    return task;
  }

  // Resolve all saved/default values once, before the stylesheet can paint.
  applyRoot();
  write('planningpoker-theme', state.themeMode);
  write('lang', state.language);
  const domReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();
  const ready = domReady.then(() => setLanguage(state.language, 'init'));
  window.PPUI = Object.freeze({
    snapshot, setTheme, setLanguage, message, ready,
    subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); }
  });
  window.setLanguage = code => setLanguage(code);
  window.addEventListener('pp:lang-change', event => {
    const detail = event.detail || {};
    const code = detail.lang || detail.to;
    if (code && normalizeLang(code) !== state.language) setLanguage(code, detail.source || 'header');
  });
})();
