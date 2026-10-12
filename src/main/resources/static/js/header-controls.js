// Header/menu language views consume the shared preferences without owning state.
(() => {
  'use strict';
  function reflectLangUI(lang) {
    document.querySelectorAll('[data-header-language]').forEach((button) => {
      const code = button.dataset.headerLanguage;
      const selected = code === lang;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.title = code === 'de' ? 'Language: German' : 'Language: English';
      button.setAttribute('aria-label', button.title);
    });
  }
  function reflectThemeUI(mode) {
    document.querySelectorAll('[data-theme-mode]').forEach((button) => {
      const selected = button.dataset.themeMode === mode;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function init() {
    window.PPUI.subscribe(state => {
      reflectLangUI(state.language);
      reflectThemeUI(state.themeMode);
    });
    document.querySelectorAll('[data-header-language]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        window.PPUI.setLanguage(button.dataset.headerLanguage);
      });
    });
    document.querySelectorAll('[data-theme-mode]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        window.PPUI.setTheme(button.dataset.themeMode);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
