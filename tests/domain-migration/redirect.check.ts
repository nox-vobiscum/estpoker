import { test, expect } from '@playwright/test';
import { request as httpsRequest } from 'node:https';

for (const path of ['/', '/about?lang=de&utm_source=domain-check',
  '/room?roomCode=Migration%2BCheck&participantName=A%20B&lang=en',
  '/invite?roomCode=Migration%2BCheck&x=1&x=2']) {
  test(`old domain redirects once preserving path and query: ${path}`, async ({ request }) => {
    const old = await request.get(`https://ep.rbsnet.at${path}`, { maxRedirects: 0 });
    expect(old.status()).toBe(301);
    const target = `https://planning-poker.at${path}`;
    expect(old.headers().location).toBe(target);
    const next = await request.get(target, { maxRedirects: 0 });
    expect(next.status()).toBe(200);
  });
}

test('legacy WebSocket upgrade is not redirected', async () => {
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const req = httpsRequest('https://ep.rbsnet.at/gameSocket?roomCode=domain-upgrade&participantName=UpgradeCheck', {
      headers: { Connection: 'Upgrade', Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        Origin: 'https://ep.rbsnet.at' },
    });
    req.on('upgrade', (response, socket) => { socket.destroy(); resolve(response.statusCode); });
    req.on('response', response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('WebSocket upgrade timed out')));
    req.end();
  });
  expect(status).toBe(101);
});
