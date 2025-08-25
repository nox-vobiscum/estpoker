// ws-probe.js — minimal WebSocket handshake probe with loud logging
(function () {
  const TAG = '[WS-PROBE]';

  function getParam(name){
    const url = new URL(location.href);
    return url.searchParams.get(name) || '';
  }
  function readNames(){
    // Try data-* first (room.html passes them), then URL fallback
    const script = document.querySelector('script[src*="/room.js"]');
    const ds = (script && script.dataset) || {};
    const participantName = ds.participant || getParam('participantName') || 'Guest';
    const roomCode        = ds.room        || getParam('roomCode')        || 'demo';
    return { participantName, roomCode };
  }

  function connect(){
    const { participantName, roomCode } = readNames();
    const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const url = wsProtocol + location.host
      + '/gameSocket?roomCode=' + encodeURIComponent(roomCode)
      + '&participantName=' + encodeURIComponent(participantName)
      + '&cid=' + encodeURIComponent((sessionStorage.getItem('ep-cid') || (function(){const id=Math.random().toString(36).slice(2)+'-'+Date.now(); try{sessionStorage.setItem('ep-cid', id);}catch(e){} return id;})()));

    console.info(`${TAG} attempting →`, url);
    let s;
    try {
      s = new WebSocket(url);
    } catch (e) {
      console.error(`${TAG} constructor failed`, e);
      return;
    }

    s.onopen = () => console.info(`${TAG} OPEN`);
    s.onerror = (e) => console.warn(`${TAG} ERROR`, e);
    s.onclose = (e) => console.warn(`${TAG} CLOSE`, e.code, e.reason || '');
    s.onmessage = (ev) => {
      console.info(`${TAG} MSG`, ev.data);
      // don’t keep it open forever during probe
      try { s.close(1000, 'probe done'); } catch(e){}
    };
  }

  window.addEventListener('error', e => {
    console.error(`${TAG} JS error`, e.message || e.error);
  });
  window.addEventListener('unhandledrejection', e => {
    console.error(`${TAG} Unhandled promise rejection`, e.reason);
  });

  // Run after DOM ready to ensure <script data-*> exists
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
