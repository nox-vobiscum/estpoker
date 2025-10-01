const fs = require('fs');
const gl = require('glob');

function dedupImports(file){
  let s = fs.readFileSync(file,'utf8');
  if (!s.includes("./_setup/prod-helpers")) return false;
  const orig = s;
  s = s.replace(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/utils\/env['"]\s*;?/gms, (m, inside)=>{
    const names = inside.split(',').map(x=>x.trim()).filter(Boolean);
    const kept = names.filter(n => !/^roomUrlFor$|^newRoomCode$/.test(n));
    if (kept.length===0) return '';                         // drop import entirely
    return `import { ${kept.join(', ')} } from './utils/env';`;
  });
  if (s !== orig){ fs.writeFileSync(file,s); console.log('dedup:', file); }
}

const prodFiles = [...gl.sync('tests/prod-*.spec.ts'), ...gl.sync('tests/toggles.spec.ts')];
prodFiles.forEach(f => fs.existsSync(f) && dedupImports(f));

// ---- Patch tests/sequence-change.spec.ts ----
(() => {
  const f='tests/sequence-change.spec.ts';
  if (!fs.existsSync(f)) return;
  let s = fs.readFileSync(f,'utf8'), orig=s;
  s = s.replace(/return\s+sel\s*\?\s*sel\.value\s*:\s*null\s*;/,
                "return sel ? (sel as HTMLSelectElement).value : null;");
  s = s.replace(/return\s+!!el\s*&&\s*!el\.disabled\s*;/,
                "return !!el && !(el as HTMLButtonElement).disabled;");
  s = s.replace(/await\s+expect\(\s*guestRadios\s*\)\.toHaveCountGreaterThan\(0\);/,
                "await expect(await guestRadios.count()).toBeGreaterThan(0);");
  s = s.replace(/evaluateAll\(\s*list\s*=>\s*list\.map\(\s*el\s*=>\s*el\.disabled\s*\)\s*\)/,
                "evaluateAll(list => list.map((el: any) => (el as HTMLInputElement).disabled))");
  if (s!==orig){ fs.writeFileSync(f,s); console.log('patched:', f); }
})();

// ---- Patch tests/specials-stats.spec.ts ----
(() => {
  const f='tests/specials-stats.spec.ts';
  if (!fs.existsSync(f)) return;
  let s = fs.readFileSync(f,'utf8'), orig=s;
  s = s.replace(/await\s+expect\(\s*chips\s*\)\.toHaveCountGreaterThan\(0\);/,
                "await expect(await chips.count()).toBeGreaterThan(0);");
  if (s!==orig){ fs.writeFileSync(f,s); console.log('patched:', f); }
})();

// ---- Patch tests/prod-spectator-disables.spec.ts (.disabled typing) ----
(() => {
  const f='tests/prod-spectator-disables.spec.ts';
  if (!fs.existsSync(f)) return;
  let s = fs.readFileSync(f,'utf8'), orig=s;
  s = s.replace(/\.every\(\s*([a-zA-Z_]\w*)\s*=>\s*\1\.disabled\s*===\s*true\s*\)/g,
                ".every(($1: any) => ($1 as any).disabled === true)");
  s = s.replace(/\.some\(\s*([a-zA-Z_]\w*)\s*=>\s*!\s*\1\.disabled\s*\)/g,
                ".some(($1: any) => !($1 as any).disabled)");
  s = s.replace(/\.some\(\s*([a-zA-Z_]\w*)\s*=>\s*\1\.disabled\s*===\s*false\s*\)/g,
                ".some(($1: any) => ($1 as any).disabled === false)");
  if (s!==orig){ fs.writeFileSync(f,s); console.log('patched:', f); }
})();
