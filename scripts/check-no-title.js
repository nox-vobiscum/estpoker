#!/usr/bin/env node
/* 
 * Simple repo-wide guardrail against user-facing title="..." attributes.
 * Allowed exceptions can be marked inline: <!-- allow-title-check -->
 */
const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'target', 'build', 'dist', '.idea', '.vscode'
]);

// Scan only markup / templating where title="..." appears as attributes.
const ALLOWED_EXT = new Set([
  '.html', '.htm', '.jsp', '.jsx', '.tsx', '.vue'
]);

const ALLOW_INLINE_MARK = 'allow-title-check';

let violations = [];

function shouldSkipDir(dir) {
  return IGNORED_DIRS.has(path.basename(dir));
}

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return;

  const text = fs.readFileSync(filePath, 'utf8');

  // Skip files explicitly allowed
  if (text.includes(ALLOW_INLINE_MARK)) return;

  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Allow semantic <abbr title="...">
    const isAbbr = /<abbr[^>]*\btitle\s*=\s*"/i.test(trimmed);

    // Flag only real attributes with a double-quoted value
    const hasTitleAttr = /\btitle\s*=\s*"/i.test(trimmed);

    if (hasTitleAttr && !isAbbr) {
      violations.push({
        file: filePath,
        line: idx + 1,
        preview: trimmed.slice(0, 200)
      });
    }
  });
}

function walk(dir) {
  if (shouldSkipDir(dir)) return;
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

walk(process.cwd());

if (violations.length > 0) {
  console.error('❌ Found forbidden user-facing title="..." attributes:\n');
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line}  ${v.preview}`);
  }
  console.error('\nHint: Use ui/tooltip.js instead, or add <!-- allow-title-check --> if truly needed.');
  process.exit(1);
}

console.log('✅ No user-facing title="..." attributes found.');
