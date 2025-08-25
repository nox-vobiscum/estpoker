// ws-probe.js — minimal WebSocket handshake probe with loud logging
(function () {
  const TAG = '[WS-PROBE]';

  function getParam(name){
    const url = new URL(location.href);
    return url.searchParams.get(name) || '';
  }
  function readNames(){
    const script = document.querySelector('script[src*="/room.js"]');
    const ds = (script && script.dataset) || {};
    const participantName = ds.participant || getParam('participantName') || 'Guest';
    const roomCode        = ds.room        || getParam('roomCode')        || 'demo';
    return { participantName, roomCode };
  }

  function connect(){
    const { participantName, roomCode } = readNames();
    const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const cidKey='ep-cid';
    let cid = null;
    try { cid = sessionStorage.getItem(cidKey); if(!cid){ cid=(Math.random().toString(36).slice(2)+'-'+Date.now()); sessionStorage.setItem(cidKey,cid);} } catch(e) { cid = 'probe-'+Date.now(); }

    const url = wsProtocol + location.host
      + '/gameSocket?roomCode=' + encodeURIComponent(roomCode)
      + '&participantName=' + encodeURIComponent(participantName)
      + '&cid=' + encodeURIComponent(cid);

    console.info(`${TAG} attempting →`, url);
    let s;
    try { s = new WebSocket(url); } catch (e) { console.error(`${TAG} constructor failed`, e); return; }

    s.onopen    = () => console.info(`${TAG} OPEN`);
    s.onerror   = (e) => console.warn(`${TAG} ERROR`, e);
    s.onclose   = (e) => console.warn(`${TAG} CLOSE`, e.code, e.reason || '');
    s.onmessage = (ev) => { console.info(`${TAG} MSG`, ev.data); try{ s.close(1000, 'probe done'); }catch(e){} };
  }

  window.addEventListener('error', e => console.error(`${TAG} JS error`, e.message || e.error));
  window.addEventListener('unhandledrejection', e => console.error(`${TAG} Unhandled promise rejection`, e.reason));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connect);
  else connect();
})();
