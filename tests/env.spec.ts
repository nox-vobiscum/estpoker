import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';

test('PP URLs and local defaults construct room links correctly', () => {
  const code = ts.transpileModule(fs.readFileSync('tests/utils/env.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  for (const [env, expectedBase, expectedRoom] of [
    [{ PP_BASE_URL: 'https://planning-poker.at/', PP_ROOM_URL: 'https://planning-poker.at/room?lang=de' },
      'https://planning-poker.at', 'https://planning-poker.at/room?lang=de'],
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

test('menu guard uses PP paths and fails for missing input', () => {
  const env = { ...process.env };
  for (const key of ['PP_MENU_JS', 'PP_ROOM_JS', 'PP_CHECK_LOG']) delete env[key];
  const run = (overrides: NodeJS.ProcessEnv) => spawnSync(process.execPath,
    ['scripts/check-menu-toggle-events.js'], { env: { ...env, ...overrides }, encoding: 'utf8' });
  expect(run({ PP_MENU_JS: 'src/main/resources/static/js/menu.js',
    PP_ROOM_JS: 'src/main/resources/static/js/room.js', PP_CHECK_LOG: '1' }).status).toBe(0);
  expect(run({ PP_MENU_JS: 'missing.js' }).status).not.toBe(0);
});
