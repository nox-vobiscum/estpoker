// Shared, synchronous storage migration. Legacy values remain available for rollback.
(() => {
  'use strict';
  const read = (area, key, aliases = [], valid = value => value !== null) => {
    try {
      const storage = window[area];
      for (const candidate of [key, ...aliases]) {
        const value = storage.getItem(candidate);
        if (!valid(value)) continue;
        if (candidate !== key) {
          try { storage.setItem(key, value); } catch {}
        }
        return value;
      }
    } catch {}
    return null;
  };
  const theme = () => read('localStorage', 'planningpoker-theme',
    ['estpoker-theme', 'ep-theme', 'theme', 'themeMode'],
    value => ['light', 'dark', 'system'].includes(value));
  const uiStyle = () => read('localStorage', 'pp-ui-style', ['ep-ui-style'],
    value => ['dev', 'clean'].includes(value));
  const consumeFlash = () => {
    const value = read('sessionStorage', 'pp-flash', ['ep-flash'],
      item => ['kicked', 'roomClosed'].includes(item));
    // Consume both aliases to prevent the same one-shot message on the next visit.
    try {
      sessionStorage.removeItem('pp-flash');
      sessionStorage.removeItem('ep-flash');
    } catch {}
    return value;
  };
  window.PPStorage = Object.freeze({ read, theme, uiStyle, consumeFlash });
})();
