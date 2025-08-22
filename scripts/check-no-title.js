#!/usr/bin/env node
/*
 * Guardrail: block user-facing title="..." attributes in markup files.
 * Allowed exceptions: <!-- allow-title-check -->
 * Whitelist: semantic <abbr title="...">
 * This version ignores HTML comments.
 */
const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'target', 'build', 'dist', '.idea', '.vscode']);
const SCANNED_EXTS = new Set(['.html', '.htm', '.jsp', '.jsx', '.tsx', '.vue']);
const ALLOW_INLINE_MARK = 'allow-title-check';

const violations = [];

function shouldSkipDir(p){ return IGNORED_DIRS.has(path.basename(p)); }

function walk(dir){
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes:true }); } catch { return; }
  for(const e of entries){
    const p = path.join(dir, e.name);
    if(e.isDirectory()){ if(!shouldSkipDir(p)) walk(p); }
    else if(e.isFile()){ scanFile(p); }
  }
}

function scanFile(filePath){
  const ext = path.extname(filePath).toLowerCase();
  if(!SCANNED_EXTS.has(ext)) return;

  let text;
  try { text = fs.readFileSync(filePath, 'utf8'); } catch { return; }
  if(text.includes(ALLOW_INLINE_MARK)) return;

  const lines = text.split(/\r?\n/);
  let inComment = false;

  for(let i=0;i<lines.length;i++){
    let line = lines[i];
    let toCheck = line;

    // strip HTML comments while keeping content outside
    if(inComment){
      const end = toCheck.indexOf('-->');
      if(end === -1) continue; // still inside comment
      toCheck = toCheck.slice(end+3);
      inComment = false;
    }
    // remove any comment segments starting here (and track if it continues)
    for(;;){
      const start = toCheck.indexOf('<!--');
      if(start === -1) break;
      const end = toCheck.indexOf('-->', start+4);
      if(end === -1){
        inComment = true;
        toCheck = toCheck.slice(0, start);
        break;
      } else {
        toCheck = toCheck.slice(0, start) + toCheck.slice(end+3);
      }
    }

    const trimmed = toCheck.trim();
    if(!trimmed) continue;

    // allow semantic <abbr title="...">
    const isAbbr = /<abbr[^>]*\btitle\s*=\s*"/i.test(trimmed);
    const hasTitleAttr = /\btitle\s*=\s*"/i.test(trimmed);

    if(hasTitleAttr && !isAbbr){
      violations.push({ file:filePath, line:i+1, preview: trimmed.slice(0,200) });
    }
  }
}

walk(process.cwd());

if(violations.length){
  console.error('❌ Found forbidden user-facing title="..." attributes:\n');
  for(const v of violations){
    console.error(`- ${v.file}:${v.line}  ${v.preview}`);
  }
  console.error('\nHint: Use /js/ui/tooltip.js instead, or add <!-- allow-title-check --> if truly needed.');
  process.exit(1);
} else {
  console.log('✅ No user-facing title="..." attributes found.');
}
