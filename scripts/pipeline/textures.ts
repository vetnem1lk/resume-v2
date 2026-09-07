// Texture byte budget: export the used PNG set from UE once, then resize / composite with sharp
// and encode every planned class x size with ktx create, validate each file, sum the tier-1 pick.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEXTURE_PLAN, TIER1_EXCLUDE, TIER1_PICK, ktxArgs, validateArgs, type TexPlan } from '../../src/pipeline/ktx.ts';
import { PATHS, REPO_ROOT } from './paths.ts';
import { runUe } from './run-ue.ts';

// sharp is vendored inside the gltf-transform CLI tree, so it is loaded by URL and carries no
// resolvable types here: the handful of operations this script uses are declared instead.
type Plane = { raw: { width: number; height: number; channels: 1 | 3 | 4 } };
interface Image {
  metadata(): Promise<{ width?: number; height?: number; channels?: number }>;
  extractChannel(band: number): Image;
  removeAlpha(): Image;
  resize(width: number, height: number, options: { kernel: string }): Image;
  joinChannel(images: Buffer | Buffer[], options?: Plane): Image;
  raw(): Image;
  png(): Image;
  toBuffer(): Promise<Buffer>;
  toFile(file: string): Promise<unknown>;
}
const { default: sharp } = await import(`file:///${PATHS.gltfModules}sharp/lib/index.js`) as {
  default: (input: string | Buffer, options?: Plane) => Image;
};
const texRoot = resolve(PATHS.raw, 'mg_textures');
const s2 = resolve(PATHS.build, 's2');
const outDir = resolve(s2, 'ktx2');
const tmpDir = resolve(s2, 'tex');
mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

// UE's TextureExporterPNG reports FormatExtension "PNG", so the exported files are <name>.PNG.
const png = (pkg: string) => resolve(texRoot, pkg.replace(/^\//, '') + '.PNG');
const wanted = [...new Set(TEXTURE_PLAN.flatMap((p) => p.sources))];
if (wanted.some((p) => !existsSync(png(p)))) {
  process.env.S2_TEX_OUT = texRoot.replace(/\\/g, '/');
  process.env.S2_TEX_ASSETS = wanted.join(';');
  const r = await runUe(resolve(REPO_ROOT, 'scripts/pipeline/ue/export_textures.py'), resolve(s2, 'textures.log'), wanted.map(png));
  console.log('UE textures:', JSON.stringify(r));
}

async function prepare(p: TexPlan, dim: number): Promise<{ file: string; channels: 1 | 3 | 4 }> {
  const file = resolve(tmpDir, `${p.key}@${dim}.png`);
  let img = sharp(png(p.sources[0]));
  if (p.composite === 'hair-rgba') {
    const alpha = await sharp(png(p.sources[1])).extractChannel(0).resize(dim, dim, { kernel: 'lanczos3' }).toBuffer();
    img = sharp(await img.removeAlpha().resize(dim, dim, { kernel: 'lanczos3' }).toBuffer()).joinChannel(alpha);
  } else if (p.composite === 'skin-orm') {
    // glTF ORM: R = occlusion (none in the pack -> 255), G = roughness, B = metallic (skin = 0).
    // Every band is joined as a raw plane: joinChannel applies one options object to all of them.
    const plane = { raw: { width: dim, height: dim, channels: 1 as const } };
    const rough = await sharp(png(p.sources[0])).extractChannel(0).resize(dim, dim, { kernel: 'lanczos3' }).raw().toBuffer();
    const white = Buffer.alloc(dim * dim, 255);
    const black = Buffer.alloc(dim * dim, 0);
    img = sharp(white, plane).joinChannel([rough, black], plane);
  } else {
    const meta = await img.metadata();
    if (p.cls === 'n' || p.cls === 'orm' || p.cls === 'orm_u') img = img.removeAlpha();
    if (p.cls === 'bc' && meta.channels === 4) img = img.removeAlpha();
    if (p.cls === 'mask') img = img.extractChannel(0);
    if (dim < Math.max(meta.width ?? 0, meta.height ?? 0)) img = img.resize(dim, dim, { kernel: 'lanczos3' });
  }
  await img.png().toFile(file);
  const ch = (await sharp(file).metadata()).channels;
  if (ch !== 1 && ch !== 3 && ch !== 4) throw new Error(`${p.key}@${dim}: ${ch} channels, no KTX2 recipe for that`);
  return { file, channels: ch };
}

const rows: { key: string; cls: string; dim: number; channels: number; srcBytes: number; ktx2Bytes: number; valid: boolean; seconds: number }[] = [];
for (const p of TEXTURE_PLAN) {
  for (const dim of p.dims) {
    const t0 = Date.now();
    const { file, channels } = await prepare(p, dim);
    const out = resolve(outDir, `${p.key}@${dim}.ktx2`);
    execFileSync(PATHS.ktx, ['create', ...ktxArgs(p.cls, channels), file, out], { stdio: 'pipe' });
    execFileSync(PATHS.ktx, validateArgs(out), { stdio: 'pipe' });     // throws on exit != 0
    rows.push({ key: p.key, cls: p.cls, dim, channels, srcBytes: statSync(file).size, ktx2Bytes: statSync(out).size, valid: true, seconds: Math.round((Date.now() - t0) / 1000) });
    console.log(`${p.key}@${dim} ${p.cls} ${channels}ch -> ${statSync(out).size} B`);
  }
}
// A pick the matrix never encoded must not contribute a silent 0: that under-reports tier 1.
const pick = (key: string, dim: number) => {
  const row = rows.find((r) => r.key === key && r.dim === dim);
  if (!row) throw new Error(`no encoded row for ${key}@${dim}`);
  return row.ktx2Bytes;
};
const tier1Bytes = Object.entries(TIER1_PICK).filter(([k]) => !TIER1_EXCLUDE.has(k)).reduce((n, [k, d]) => n + pick(k, d), 0);
const tier2HeadBytes = pick('head_bc', 2048);
const summary = { rows, tier1Bytes, tier2HeadBytes, pick: TIER1_PICK };
writeFileSync(resolve(s2, 'ktx2-budget.json'), JSON.stringify(summary, null, 1));
const md = ['| key | class | dim | ch | PNG B | KTX2 B | tier-1 |', '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.key} | ${r.cls} | ${r.dim} | ${r.channels} | ${r.srcBytes} | ${r.ktx2Bytes} | ${TIER1_PICK[r.key] === r.dim && !TIER1_EXCLUDE.has(r.key) ? 'x' : ''} |`),
  '', `Tier-1 textures: ${tier1Bytes} B (${(tier1Bytes / 1e6).toFixed(2)} MB); tier-2 head BC 2048 sidecar: ${tier2HeadBytes} B`].join('\n') + '\n';
writeFileSync(resolve(s2, 'ktx2-budget.md'), md);
console.log(md);
