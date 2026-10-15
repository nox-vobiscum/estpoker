// Shared, synchronous access to current application storage keys.
(() => {
  'use strict';
  const read = (area, key, valid = value => value !== null) => {
    try {
      const value = window[area].getItem(key);
      if (valid(value)) return value;
    } catch {}
    return null;
  };
  const theme = () => read('localStorage', 'planningpoker-theme',
    value => ['light', 'dark', 'system'].includes(value));
  const consumeFlash = () => {
    const value = read('sessionStorage', 'pp-flash',
      item => ['kicked', 'roomClosed'].includes(item));
    // Consume the one-shot message before the next visit.
    try {
      sessionStorage.removeItem('pp-flash');
    } catch {}
    return value;
  };
  window.PPStorage = Object.freeze({ read, theme, consumeFlash });
})();
