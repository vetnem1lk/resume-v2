// Writes dist-nojs/: a copy of dist/ with every executable <script> and every JS preload
// removed from every HTML file. Lighthouse cannot disable JavaScript (no setting, no CLI
// flag, no Chromium switch), so this stripped copy is the honest "JS disabled" audit
// target: the resume must score on its markup alone. Data blocks (application/ld+json)
// are kept; the script exits 1 if any executable script survives.
import { cpSync, globSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const out = fileURLToPath(new URL('../dist-nojs/', import.meta.url));
const KEEP = /type\s*=\s*["']?(application\/ld\+json|application\/json|text\/template)["']?/i;

rmSync(out, { recursive: true, force: true });
cpSync(dist, out, { recursive: true });

const files = globSync('**/*.html', { cwd: out }).map((f) => join(out, f));
for (const file of files) {
  const html = readFileSync(file, 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => (KEEP.test(m) ? m : ''))
    .replace(/<link\b[^>]*\brel\s*=\s*["']?modulepreload["']?[^>]*>/gi, '');
  writeFileSync(file, html);
}
const left = files.filter((f) => [...readFileSync(f, 'utf8').matchAll(/<script\b[^>]*>/gi)].some((m) => !KEEP.test(m[0])));
console.log(`[nojs] ${files.length} html file(s) written to dist-nojs/; executable scripts left: ${left.length ? left.join(', ') : 'none'}`);
process.exitCode = left.length ? 1 : 0;
