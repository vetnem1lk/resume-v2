// Byte gates over dist/. Measures gz9 (zlib level 9, the number the README quotes,
// not the build log's column) for the entry assets referenced by dist/index.html,
// proves the entry contains no three.js, that no font was base64-inlined into the
// stylesheet, and that the Russian document was emitted. Exit code = failures.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const budget = JSON.parse(readFileSync(new URL('../budget.json', import.meta.url), 'utf8'));
const gz9 = (buf) => gzipSync(buf, { level: 9 }).length;

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const html = readFileSync(`${dist}index.html`, 'utf8');
// Vite writes hashed assets under /assets/; the shell references them by absolute path.
const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const js = refs.filter((r) => r.endsWith('.js'));
const css = refs.filter((r) => r.endsWith('.css'));
check('entry assets referenced', js.length >= 1 && css.length >= 1, `${js.length} js, ${css.length} css`);

const sum = (list) => list.reduce((n, r) => n + gz9(readFileSync(dist + r.slice(1))), 0);
const entryJs = sum(js);
const entryCss = sum(css);
const indexHtml = gz9(html);
check('entry-js gz9', entryJs <= budget['entry-js'], `${entryJs} <= ${budget['entry-js']} B`);
check('entry-css gz9', entryCss <= budget['entry-css'], `${entryCss} <= ${budget['entry-css']} B`);
check('index-html gz9', indexHtml <= budget['index-html'], `${indexHtml} <= ${budget['index-html']} B`);

// Entry purity: three.js never enters the first-paint JS. Class literals survive
// minification; identifier-shaped needles do not, so the probe is a class name.
for (const r of js) {
  const src = readFileSync(dist + r.slice(1), 'utf8');
  check(`no three.js in ${r}`, !/WebGLRenderer|PerspectiveCamera/.test(src));
}
for (const r of css) {
  const src = readFileSync(dist + r.slice(1), 'utf8');
  check(`no inlined font in ${r}`, !/data:(?:font|application\/(?:x-)?font)/.test(src));
}

const ru = `${dist}ru/index.html`;
const ruHtml = existsSync(ru) ? readFileSync(ru, 'utf8') : '';
check('ru document emitted', ruHtml.includes('<html lang="ru"'));

// Long dashes are banned in the shipped bytes, the en dash as a separator included.
check('no em-dash or en-dash in either document', !/[–—]/.test(html + ruHtml));

console.log(failures ? `\n${failures} failed` : '\nall ok');
process.exitCode = failures;
