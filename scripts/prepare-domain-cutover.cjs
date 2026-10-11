// Explicit, reviewable cutover preparation; never invoked by build or deployment.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.some(arg => !['--apply'].includes(arg))) throw new Error('Usage: node scripts/prepare-domain-cutover.cjs [--apply]');
const files = [
  'src/main/resources/templates/fragments/head.html',
  'src/main/resources/static/robots.txt',
  'src/main/resources/static/sitemap.xml',
  '.github/workflows/health-monitoring.yml',
  'tests/seo.spec.ts',
  'README.md', 'docs/API.md', 'docs/ARCHITECTURE.md', 'docs/BRIEFING.md',
  'docs/DEPLOYMENT.md', 'docs/USER-GUIDE.md', 'docs/USER-GUIDE-EN.md',
];
// Validate all inputs before writing. Preserve origin allowlists and historical files.
const changes = files.map(file => {
  const full = path.join(root, file);
  const bytes = fs.readFileSync(full);
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf16le' : 'utf8';
  const before = bytes.toString(encoding);
  const after = before.split(/(?<=\n)/).map(line =>
    line.includes('allowed-origins=') ? line : line.replaceAll('ep.rbsnet.at', 'planning-poker.at')
  ).join('');
  if (before === after) throw new Error(`No old domain found in ${file}; review drift or already-applied cutover.`);
  return { file, full, encoding, after };
});
for (const change of changes) {
  console.log(`${args.includes('--apply') ? 'UPDATE' : 'WOULD UPDATE'} ${change.file}`);
  if (args.includes('--apply')) fs.writeFileSync(change.full, change.after, change.encoding);
}
console.log('No redirect or infrastructure changes. Review diff and commit separately only after Go-Live approval.');
