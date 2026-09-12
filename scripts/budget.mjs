// Byte gates over dist/. Measures gz9 (zlib level 9, the number the README quotes,
// not the build log's column) for the entry assets referenced by dist/index.html and
// for the lazily imported scene chunk, proves the entry contains no three.js and that
// no source outside src/island/ imports it, that no font was base64-inlined into the
// stylesheet, that every emitted JS chunk is reachable from the entry, that the
// Russian document was emitted, and that both documents carry the recruiter gate's
// four elements in markup. Exit code = failures.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = `${root}dist/`;
const budget = JSON.parse(readFileSync(`${root}budget.json`, 'utf8'));
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
check('entry references one chunk', js.length === 1 && css.length >= 1, `${js.length} js, ${css.length} css`);

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

// Every emitted JS chunk must be reachable from a document: the entry by <script>, the scene
// chunk by the entry's import(). three's KTX2Loader makes Vite emit basis_transcoder.js as a
// hashed ASSET ending in .js that no chunk references (the transcoder worker fetches it).
const ASSET_JS = /^basis_transcoder-[\w-]+\.js$/;
const emitted = readdirSync(`${dist}assets`).filter((f) => f.endsWith('.js'));
const entryChunks = new Set(js.map((r) => r.split('/').at(-1)));
const reachable = new Set(entryChunks);
for (const file of reachable) {
  const src = readFileSync(`${dist}assets/${file}`, 'utf8');
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["'`]\.\/([\w.-]+\.js)["'`]/g)) reachable.add(m[1]);
}
const orphans = emitted.filter((f) => !reachable.has(f) && !ASSET_JS.test(f));
check('no orphan js chunk', orphans.length === 0, orphans.join(' ') || emitted.join(' '));

// The scene is whatever the entry imports lazily: at least one chunk (an empty set means the
// island was hoisted into an eager script or dropped), all of it within its own budget.
const scene = [...reachable].filter((f) => !entryChunks.has(f));
const sceneJs = scene.reduce((n, f) => n + gz9(readFileSync(`${dist}assets/${f}`)), 0);
check('scene chunk emitted', scene.length >= 1, scene.join(' ') || 'none');
check('scene-js gz9', scene.length >= 1 && sceneJs <= budget['scene-js'], `${sceneJs} <= ${budget['scene-js']} B`);

// Source purity: three.js is imported under src/island/ and nowhere else, so the pure rig stays
// testable under Node and the entry cannot grow a three import by accident.
const sources = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.ts'))
  .map((e) => `${e.parentPath ?? e.path}/${e.name}`.replaceAll('\\', '/'));
const leaks = sources(`${root}src`).filter((f) => !f.includes('/src/island/') && /from\s+['"]three(?:\/|['"])/.test(readFileSync(f, 'utf8')));
check('three imported only under src/island', leaks.length === 0, leaks.map((f) => f.slice(root.length)).join(' '));

const ru = `${dist}ru/index.html`;
const ruHtml = existsSync(ru) ? readFileSync(ru, 'utf8') : '';
check('ru document emitted', ruHtml.includes('<html lang="ru"'));
check('ru-html gz9', gz9(ruHtml) <= budget['index-html'], `${gz9(ruHtml)} <= ${budget['index-html']} B`);

// The em-dash is banned in the shipped bytes (plan gate); the en dash stays, it is the
// separator the plan mandates for date ranges.
check('no em-dash in either document', !/—/.test(html + ruHtml));

// Recruiter gate (design doc, section 5): "name, role, one proof, CV button in index.html
// with JS off; PDF in one click". All four are markup the build emits, and nojs.mjs
// removes scripts only, so what passes here is what a visitor with JS off gets.
const RECRUITER = [
  // [^<] so an empty element does not pass on its own closing tag; the proof needs a
  // sentence, not a word, hence the 80 characters of uninterrupted text. The CV button
  // carries interaction attributes after the download, which stay outside the match.
  ['name', /<h1[^>]*>\s*[^<\s]/],
  ['role', /class="role"[^>]*>\s*[^<\s]/],
  ['proof', /<p class="profile">[^<]{80}/],
  ['one-click CV', /<a class="cv-button" href="\/cv\/[^"]+\.pdf" download[^>]*>/],
];
for (const [doc, src] of [['index.html', html], ['ru/index.html', ruHtml]]) {
  const missing = RECRUITER.filter(([, re]) => !re.test(src)).map(([label]) => label);
  check(`recruiter gate in ${doc}`, missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : 'name, role, proof, one-click CV');
}

console.log(failures ? `\n${failures} failed` : '\nall ok');
process.exitCode = failures;
