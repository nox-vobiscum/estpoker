import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';

test('PP URLs take precedence; EP URLs and local defaults remain usable', () => {
  const code = ts.transpileModule(fs.readFileSync('tests/utils/env.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  for (const [env, expectedBase, expectedRoom] of [
    [{ PP_BASE_URL: 'https://new.invalid/', EP_BASE_URL: 'https://old.invalid',
      PP_ROOM_URL: 'https://new.invalid/room?lang=de', EP_ROOM_URL: 'https://old.invalid/room' },
      'https://new.invalid', 'https://new.invalid/room?lang=de'],
    [{ EP_BASE_URL: 'https://old.invalid/', EP_ROOM_URL: 'https://old.invalid/room?lang=en' },
      'https://old.invalid', 'https://old.invalid/room?lang=en'],
    [{}, 'http://localhost:8080', 'http://localhost:8080/room'],
  ] as const) {
    const scope = { exports: {} as any, process: { env }, URL };
    vm.runInNewContext(code, scope);
    expect(scope.exports.baseUrl).toBe(expectedBase);
    const expected = new URL(expectedRoom);
    expected.searchParams.set('roomCode', 'ROOM');
    expected.searchParams.set('participantName', 'User');
    expect(scope.exports.roomUrlFor('User', 'ROOM')).toBe(expected.toString());
  }
});

test('menu guard accepts EP paths and prefers PP paths without false success', () => {
  const env = { ...process.env };
  for (const key of ['PP_MENU_JS', 'PP_ROOM_JS', 'PP_CHECK_LOG', 'EP_MENU_JS', 'EP_ROOM_JS', 'EP_CHECK_LOG']) delete env[key];
  const menu = 'src/main/resources/static/js/menu.js';
  const room = 'src/main/resources/static/js/room.js';
  const run = (overrides: NodeJS.ProcessEnv) => spawnSync(process.execPath,
    ['scripts/check-menu-toggle-events.js'], { env: { ...env, ...overrides }, encoding: 'utf8' });
  expect(run({ EP_MENU_JS: menu, EP_ROOM_JS: room, EP_CHECK_LOG: '1' }).status).toBe(0);
  expect(run({ PP_MENU_JS: menu, PP_ROOM_JS: room, EP_MENU_JS: 'missing.js', EP_ROOM_JS: 'missing.js' }).status).toBe(0);
  expect(run({ PP_MENU_JS: 'missing.js', EP_MENU_JS: menu }).status).not.toBe(0);
});
