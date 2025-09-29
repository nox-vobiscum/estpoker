export {};

declare global {
  interface Window {
    __epE2E_langEv?: (lang: string) => void;
    __lastVoteUpdate?: number;
    __chaos?: { start: () => void; stop: () => void };
    __epWs?: WebSocket;
    __epVU?: unknown[];
  }
  interface WebSocket {
    __hooked?: boolean;
  }
}
