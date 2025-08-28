#!/usr/bin/env node
// Guardrail: disallow user-facing HTML attributes title="..."
// Scope: src/main/resources/templates/**/*.html
// Hint: use data-tooltip="..." and aria-label instead of title="..."

'use strict';

const fs = require('fs');
const path = require('path');

const VERBOSE = !!process.env.EP_CHECK_LOG;
const TEMPLATES_ROOT = path.join('src', 'main', 'resources', 'templates');

// Match title="..." (not the <title> tag)
const ATTR_RE = /\btitle\s*=\s*"[^"]*"/ig;
// Strip <!-- ... --> comments (multi-line safe)
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

function collectHtmlFiles(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }

  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) {
      collectHtmlFiles(fp, out);
    } else if (e.isFile() && fp.toLowerCase().endsWith('.html')) {
      out.push(fp);
    }
  }
  return out;
}

function findViolations(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Ignore anything inside HTML comments so notes like title="..." don't trip the check
  const txt = raw.replace(HTML_COMMENT_RE, '');
  const lines = txt.split(/\r?\n/);
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ATTR_RE.test(line)) {
      const snippet = line.trim().slice(0, 200);
      violations.push({ line: i + 1, snippet });
    }
    ATTR_RE.lastIndex = 0;
  }
  return violations;
}

function main() {
  if (!fs.existsSync(TEMPLATES_ROOT)) {
    if (VERBOSE) console.log(`[check-no-title] Skipped: ${TEMPLATES_ROOT} not found.`);
    process.exit(0);
  }

  const files = collectHtmlFiles(TEMPLATES_ROOT);
  if (VERBOSE) console.log(`[check-no-title] Scanning ${files.length} HTML files under ${TEMPLATES_ROOT} ...`);

  const offenders = [];
  for (const f of files) {
    const v = findViolations(f);
    if (v.length) offenders.push({ file: f, entries: v });
  }

  if (offenders.length === 0) {
    console.log('✅ No user-facing title="..." attributes found.');
    process.exit(0);
  }

  console.error(`✗ Found ${offenders.length} file(s) with forbidden title="..." attributes:\n`);
  for (const o of offenders) {
    console.error(` - ${o.file}`);
    for (const e of o.entries.slice(0, 5)) {
      console.error(`     L${e.line}: ${e.snippet}`);
    }
    if (o.entries.length > 5) {
      console.error(`     ...and ${o.entries.length - 5} more occurrence(s)`);
    }
  }
  console.error('\nHint: use data-tooltip="..." and aria-label instead of title="...".');
  console.error('      Comments (<!-- ... -->) are ignored.');
  process.exit(1);
}

main();
