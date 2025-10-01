// tests/types/globals.d.ts
export {};

declare global {
  interface Window {
    // May be used as function or as numeric counter in tests — keep it loose
    __epE2E_langEv?: any;

    // Server push snapshot used by various tests (shape varies)
    __lastVoteUpdate?: any;

    // Buffer for CustomEvents collected in toggles.spec.ts
    __epE2EEvents?: Array<{ name: string; d?: any }>;

    // Chaos/diagnostic hooks
    __chaos?: { start: () => void; stop: () => void };

    // Exposed websocket + ring buffer (debug only)
    __epWs?: WebSocket;
    __epVU?: unknown[];

    // Allow monkey-patching constructor in tests
    WebSocket: any;
  }

  interface WebSocket {
    __hooked?: boolean;
  }
}
