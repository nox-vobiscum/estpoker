#!/usr/bin/env node
/* Checks for native browser tooltips: title=, el.title=, setAttribute('title',...) */
const fs = require('fs');
const path = require('path');

const roots = [
  'src/main/resources/templates',
  'src/main/resources/static'
];
const exts = new Set(['.html', '.js', '.ts']);
const offenders = [];
const allowMarker = /tooltip-allow/; // put this on a line to whitelist it

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (exts.has(path.extname(p))) scan(p);
  }
}

function scan(file) {
  const data = fs.readFileSync(file, 'utf8');
  const lines = data.split(/\r?\n/);
  const patterns = [
    { re: /\btitle\s*=/i,        kind: 'attr' },    // HTML attribute
    { re: /\.title\s*=/,         kind: 'prop' },    // JS property
    { re: /setAttribute\(\s*['"]title['"]\s*,/i, kind: 'setAttr' } // JS setAttribute
  ];
  lines.forEach((line, i) => {
    if (allowMarker.test(line)) return;
    // ignore <title>head tag (no equals sign) – our regex hits only attributes/JS
    for (const p of patterns) {
      if (p.re.test(line)) {
        offenders.push({ file, line: i + 1, kind: p.kind, text: line.trim() });
        break;
      }
    }
  });
}

for (const r of roots) if (fs.existsSync(r)) walk(r);

if (offenders.length) {
  console.error('\n❌ Forbidden tooltip usages found (title attr/prop):\n');
  for (const o of offenders) {
    console.error(` - ${o.file}:${o.line} [${o.kind}]  ${o.text}`);
  }
  console.error('\nFix: nutze data-tooltip statt title oder rufe window.__setNiceTooltip(el, text) auf.\n' +
                'Ausnahme gewollt? Markiere die Zeile mit "tooltip-allow".');
  process.exit(1);
}
console.log('✅ No forbidden `title` usages found.');
