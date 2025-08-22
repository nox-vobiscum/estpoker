#!/usr/bin/env node
/* Checks for native browser tooltips: title=, el.title=, setAttribute('title',...) */

const fs = require('fs');
const path = require('path');

const allowMarker = /tooltip-allow/; // put this on a line to whitelist it
const exts = new Set(['.html', '.htm', '.js', '.ts']);

const defaultRoots = [
  'src/main/resources/templates',
  'src/main/resources/static'
];

const offenders = [];

// --- helper --------------------------------------------------------------

function scanFile(file) {
  if (!exts.has(path.extname(file))) return;

  const data = fs.readFileSync(file, 'utf8');
  const lines = data.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // allow marker disables checks for this specific line
    if (allowMarker.test(line)) continue;

    // 1) JS: setAttribute('title', ...)
if (/setAttribute\(\s*['"]title['"]\s*,/i.test(line)) {
  offenders.push({ file, line: i + 1, kind: 'setAttr', text: line.trim() });
  continue;
}

// 2) JS: .title = ...  (document.title explizit erlauben)
if (/\.title\s*=/.test(line) && !/document\.title\s*=/.test(line)) {
  offenders.push({ file, line: i + 1, kind: 'prop', text: line.trim() });
  continue;
}

// 3) HTML-Attribut: title= innerhalb eines Tags
if (/<[^>]*\btitle\s*=/i.test(line)) {
  offenders.push({ file, line: i + 1, kind: 'attr', text: line.trim() });
  continue;
}

  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else scanFile(p);
  }
}

// --- entry ---------------------------------------------------------------

// if file paths are passed, only scan those (used by pre-commit).
// otherwise scan the default roots (for CI / manual runs).
const args = process.argv.slice(2);
if (args.length) {
  for (const f of args) if (fs.existsSync(f)) scanFile(f);
} else {
  for (const r of defaultRoots) if (fs.existsSync(r)) walk(r);
}

if (offenders.length) {
  console.error('\n❌ Forbidden tooltip usages found (title attr/prop):\n');
  for (const o of offenders) {
    console.error(` - ${o.file}:${o.line} [${o.kind}]  ${o.text}`);
  }
  console.error(
    '\nFix: nutze data-tooltip/ARIA statt native title-Tooltips\n' +
    'oder eine eigene Tooltip-API. Ausnahme? Markiere die Zeile mit "tooltip-allow".'
  );
  process.exit(1);
}

console.log('✅ No forbidden `title` usages found.');
