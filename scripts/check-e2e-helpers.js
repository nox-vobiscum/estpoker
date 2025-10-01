// scripts/check-e2e-helpers.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'tests');

const SKIP_FULL = [
  /[\\/]utils[\\/]env\.ts$/,
  /[\\/]utils[\\/]helpers\.ts$/,
  /[\\/]_setup[\\/]prod-helpers\.ts$/, // <-- wrapper is allowed
  /[\\/]types[\\/]/,
];

function walk(dir) {
  return fs.readdirSync(dir).flatMap((e) => {
    const p = path.join(dir, e);
    const s = fs.statSync(p);
    return s.isDirectory() ? walk(p) : [p];
  });
}

function shouldSkip(p) {
  return SKIP_FULL.some((re) => re.test(p));
}

const files = walk(ROOT).filter((p) => p.endsWith('.ts') && !shouldSkip(p));

const offenders = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');

  // Detect local helper definitions (we do NOT accept these in specs)
  const definesLocal =
    /\bfunction\s+baseUrl\s*\(/.test(src) ||
    /\bfunction\s+newRoomCode\s*\(/.test(src) ||
    /\bfunction\s+roomUrlFor\s*\(/.test(src) ||
    /\bconst\s+baseUrl\s*=/.test(src) ||
    /\bconst\s+newRoomCode\s*=/.test(src) ||
    /\bconst\s+roomUrlFor\s*=/.test(src);

  const usesHelpers = /\b(baseUrl|newRoomCode|roomUrlFor)\s*\(/.test(src);

  // Accept "./utils/env" or "../utils/env" (subfolders)
  const hasEnvImport = /from\s+['"](\.\/|\.\.\/)+utils\/env['"]/.test(src);

  if (definesLocal) {
    offenders.push(`${file}: defines helper that must come from ./utils/env`);
  }
  if (usesHelpers && !hasEnvImport) {
    offenders.push(`${file}: uses env helpers but missing "from './utils/env'" import`);
  }
}

if (offenders.length) {
  console.log('\nE2E helper check failed:\n');
  for (const o of offenders) console.log(' - ' + o);
  process.exit(1);
} else {
  console.log('E2E helper check OK');
}
