#!/usr/bin/env node
/*
 * Guardrail: block user-facing title="..." attributes in markup files.
 * Allowed exceptions: put <!-- allow-title-check --> somewhere in the file.
 * We also allow semantic <abbr title="..."> as a whitelist.
 */

const fs = require('fs');
const path = require('path');

// directories we never scan
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'target', 'build', 'dist', '.idea', '.vscode'
]);

// only scan markup-like files where title="..." appears as an attribute
const SCANNED_EXTS = new Set(['.html', '.htm', '.jsp', '.jsx', '.tsx', '.vue']);

// marker to skip a file entirely (use rarely)
const ALLOW_INLINE_MARK = 'allow-title-check';

const violations = [];

function shouldSkipDir(p) {
  return IGNORED_DIRS.has(path.basename(p));
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!shouldSkipDir(p)) walk(p);
    } else if (e.isFile()) {
      scanFile(p);
    }
  }
}

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCANNED_EXTS.has(ext)) return;

  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  // allow marker disables the whole file
  if (text.includes(ALLOW_INLINE_MARK)) return;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // allow semantic <abbr title="...">
    const isAbbr = /<abbr[^>]*\btitle\s*=\s*"/i.test(trimmed);

    // only flag real attributes with a quoted value
    const hasTitleAttr = /\btitle\s*=\s*"/i.test(trimmed);

    if (hasTitleAttr && !isAbbr) {
      violations.push({
        file: filePath,
        line: i + 1,
        preview: trimmed.slice(0, 200)
      });
    }
  }
}

// run
walk(process.cwd());

if (violations.length) {
  console.error('❌ Found forbidden user-facing title="..." attributes:\n');
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line}  ${v.preview}`);
  }
  console.error('\nHint: Use /js/ui/tooltip.js instead, or add <!-- allow-title-check --> if truly needed.');
  process.exit(1);
} else {
  console.log('✅ No user-facing title="..." attributes found.');
}
