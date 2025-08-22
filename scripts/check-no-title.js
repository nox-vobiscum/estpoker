#!/usr/bin/env node
/* 
 * Simple repo-wide guardrail against user-facing title= tooltips.
 * Allowed exceptions can be marked inline: <!-- allow-title-check -->
 */
const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'target', 'build', 'dist', '.idea', '.vscode'
]);

const ALLOWED_EXT = new Set([
  '.html', '.htm', '.jsp', '.js', '.ts', '.tsx', '.jsx', '.vue'
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

  // Find title="...". We allow <abbr title="..."> as a semantic exception.
  // If you need more exceptions, add a small whitelist here.
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (line.includes('title=')) {
      const trimmed = line.trim();
      const isAbbr = /<abbr[^>]*\btitle\s*=/.test(trimmed);
      if (!isAbbr) {
        violations.push({
          file: filePath,
          line: idx + 1,
          preview: trimmed.slice(0, 200)
        });
      }
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
  console.error('❌ Found forbidden user-facing title= attributes:\n');
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line}  ${v.preview}`);
  }
  console.error('\nHint: Use ui/tooltip.js instead, or add <!-- allow-title-check --> if truly needed.');
  process.exit(1);
}

console.log('✅ No user-facing title= attributes found.');
