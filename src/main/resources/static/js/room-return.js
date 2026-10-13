// Per-tab navigation back to a room after the server confirms a successful join.
(() => {
  'use strict';
  const key = 'pp-room-return';
  const tabKey = 'pp-room-return-tab';

  function tabId() {
    try {
      let id = sessionStorage.getItem(tabKey);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(tabKey, id);
      }
      return id;
    } catch { return null; }
  }

  function read() {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (!value || !value.roomCode || !value.participantName || !value.url || value.tabId !== tabId() || window.name !== 'pp-room-return:' + value.tabId) return null;
      const url = new URL(value.url, location.origin);
      if (url.origin !== location.origin || url.pathname !== '/room' || url.searchParams.has('preflight')) return null;
      if (url.searchParams.get('roomCode') !== value.roomCode || url.searchParams.get('participantName') !== value.participantName) return null;
      return value;
    } catch { return null; }
  }

  function clear(roomCode, participantName) {
    try {
      const current = read();
      if (!current || (roomCode && current.roomCode !== roomCode) || (participantName && current.participantName !== participantName)) return;
      sessionStorage.removeItem(key);
    } catch {}
    render();
  }

  function remember(roomCode, participantName) {
    if (!roomCode || !participantName) return;
    const id = tabId();
    if (!id) return;
    window.name = 'pp-room-return:' + id;
    const url = '/room?roomCode=' + encodeURIComponent(roomCode) + '&participantName=' + encodeURIComponent(participantName);
    try { sessionStorage.setItem(key, JSON.stringify({ roomCode, participantName, url, tabId: id })); } catch {}
  }

  function render() {
    const row = document.getElementById('roomReturn');
    if (!row) return;
    const context = read();
    if (!context || (location.pathname === '/invite' && new URLSearchParams(location.search).has('nameTaken') &&
        new URLSearchParams(location.search).get('roomCode') === context.roomCode &&
        new URLSearchParams(location.search).get('participantName') === context.participantName)) {
      row.hidden = true;
      return;
    }
    document.getElementById('roomReturnLink').href = context.url;
    document.getElementById('roomReturnName').textContent = context.roomCode;
    row.hidden = false;
  }

  window.PPRoomReturn = Object.freeze({ remember, clear });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
