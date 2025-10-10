// Reports files in /tests with odd number of backticks (`), ignoring escaped \`
// Also prints the first line where the count becomes odd (likely the culprit).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');

function* allTsFiles(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) yield* allTsFiles(p);
    else if (st.isFile() && p.endsWith('.ts')) yield p;
  }
}

function countBackticksLine(line) {
  // Count unescaped `
  let c = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '`' && line[i - 1] !== '\\') c++;
  }
  return c;
}

let bad = 0;
for (const f of allTsFiles(TESTS)) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  let total = 0, firstOddLine = -1, snippet = '';
  for (let i = 0; i < lines.length; i++) {
    total += countBackticksLine(lines[i]);
    if (total % 2 === 1 && firstOddLine < 0) {
      firstOddLine = i + 1;
      snippet = lines[i].slice(0, 160);
    }
  }
  if (total % 2 === 1) {
    bad++;
    console.log(`UNMATCHED \` in ${path.relative(ROOT, f)} (first odd at line ${firstOddLine}):`);
    console.log(`  ${snippet}\n`);
  }
}

if (!bad) console.log('All files have even backtick counts.');
