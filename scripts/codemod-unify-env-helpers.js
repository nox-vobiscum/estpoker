// scripts/codemod-unify-env-helpers.js
const fs = require('fs');
const path = require('path');

const TESTS_ROOT = path.resolve(__dirname, '..', 'tests');

const SKIP = [
  /[\\/]utils[\\/]env\.ts$/,
  /[\\/]utils[\\/]helpers\.ts$/,
  /[\\/]_setup[\\/]prod-helpers\.ts$/, // wrapper stays
  /[\\/]types[\\/]/,
];

function shouldSkip(p) {
  return SKIP.some((re) => re.test(p));
}

function walk(dir) {
  return fs.readdirSync(dir).flatMap((e) => {
    const p = path.join(dir, e);
    const s = fs.statSync(p);
    return s.isDirectory() ? walk(p) : [p];
  });
}

function ensureEnvImport(src, fileAbs) {
  const fileDir = path.dirname(fileAbs);
  // relative path to tests/utils/env.ts (drop extension)
  let rel = path.relative(fileDir, path.join(TESTS_ROOT, 'utils', 'env.ts'))
    .replace(/\\/g, '/')
    .replace(/\.ts$/, '');
  if (!rel.startsWith('.')) rel = './' + rel;

  const hasImport = new RegExp(`from\\s+['"]${rel}['"]`).test(src)
    || /from\s+['"](\.\/|\.\.\/)+utils\/env['"]/.test(src);

  if (hasImport) return src;

  const importLine = `import { baseUrl, newRoomCode, roomUrlFor } from '${rel}';\n`;

  // find the last import line and insert after it; otherwise prepend
  const lines = src.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s+/.test(lines[i])) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine.trimEnd());
    return lines.join('\n');
  }
  return importLine + src;
}

function stripLocalHelpers(src) {
  const patterns = [
    /\bfunction\s+baseUrl\s*\([^)]*\)\s*\{[\s\S]*?\}\s*/g,
    /\bfunction\s+newRoomCode\s*\([^)]*\)\s*\{[\s\S]*?\}\s*/g,
    /\bfunction\s+roomUrlFor\s*\([^)]*\)\s*\{[\s\S]*?\}\s*/g,
    /\bconst\s+baseUrl\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}\s*;?/g,
    /\bconst\s+newRoomCode\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}\s*;?/g,
    /\bconst\s+roomUrlFor\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}\s*;?/g,
  ];
  let out = src;
  for (const re of patterns) out = out.replace(re, '');
  return out;
}

const files = walk(TESTS_ROOT).filter((p) => p.endsWith('.ts') && !shouldSkip(p));

let changed = 0;
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;

  // If file uses helpers, unify it.
  const usesHelpers = /\b(baseUrl|newRoomCode|roomUrlFor)\s*\(/.test(src);
  if (!usesHelpers) continue;

  src = stripLocalHelpers(src);
  src = ensureEnvImport(src, path.resolve(file));

  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed++;
  }
}

console.log(`Codemod done. Files changed: ${changed}`);
