// Texture byte budget: export the used PNG set from UE once, then resize / composite with sharp
// and encode every tier-1 and tier-2 pick with ktx create, validate each file, and price both
// tiers over the wire and as resident BC7. An encode is cached by its arguments, the bytes it
// consumed and the encoder version.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEXTURE_PLAN, TIER1, TIER2, ktxArgs, manifestRow, pickFile, textureVramBytes, validateArgs, type ManifestTexture, type TexPick, type TexPlan } from '../../src/pipeline/ktx.ts';
import { PATHS, REPO_ROOT, requireTool } from './paths.ts';
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
const ktx = requireTool('ktx', PATHS.ktx, 'KTX');
const ktxVersion = execFileSync(ktx, ['--version'], { encoding: 'utf8' }).trim();
const texRoot = resolve(PATHS.raw, 'mg_textures');
const s4 = resolve(PATHS.build, 's4');
const outDir = resolve(s4, 'ktx2');
const tmpDir = resolve(s4, 'tex');
mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

// UE's TextureExporterPNG reports FormatExtension "PNG", so the exported files are <name>.PNG.
const png = (pkg: string) => resolve(texRoot, pkg.replace(/^\//, '') + '.PNG');
const wanted = [...new Set(TEXTURE_PLAN.flatMap((p) => p.sources))];
if (wanted.some((p) => !existsSync(png(p)))) {
  process.env.S2_TEX_OUT = texRoot.replace(/\\/g, '/');
  process.env.S2_TEX_ASSETS = wanted.join(';');
  const r = await runUe(resolve(REPO_ROOT, 'scripts/pipeline/ue/export_textures.py'), resolve(s4, 'textures.log'), wanted.map(png));
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

const planOf = (key: string): TexPlan => {
  const plan = TEXTURE_PLAN.find((p) => p.key === key);
  if (plan === undefined) throw new Error(`no texture plan for ${key}`);
  return plan;
};
// Both tiers land in one directory; the clothes ORM appears twice (two codecs), no file twice.
const picks: TexPick[] = [];
for (const pick of [...TIER1, ...TIER2]) if (!picks.some((p) => pickFile(p) === pickFile(pick))) picks.push(pick);

const files: ManifestTexture[] = [];
for (const pick of picks) {
  const t0 = Date.now();
  const plan = planOf(pick.key);
  const { file, channels } = await prepare(plan, pick.dim);
  const out = resolve(outDir, pickFile(pick));
  const args = ktxArgs(plan.cls, channels, pick.recipe);
  // An encode runs for minutes, so a finished file stays - but only while the arguments, the image
  // that was encoded and the encoder are all unchanged. Paths alone would serve a re-exported source
  // (or a rewritten composite) as if it were current, silently, in the log and in the budget.
  const stamp = JSON.stringify({ args, dim: pick.dim, sources: plan.sources, tool: ktxVersion, src: createHash('sha256').update(readFileSync(file)).digest('hex') });
  const sidecar = `${out}.args.json`;
  const cached = existsSync(out) && existsSync(sidecar) && readFileSync(sidecar, 'utf8') === stamp;
  if (!cached) {
    execFileSync(ktx, ['create', ...args, file, out], { stdio: 'pipe' });
    writeFileSync(sidecar, stamp);
  }
  execFileSync(ktx, validateArgs(out), { stdio: 'pipe' });   // every run, cached or not: throws on exit != 0
  files.push(manifestRow(pick, pickFile(pick), statSync(out).size));
  console.log(`${pickFile(pick)} ${plan.cls} ${pick.recipe} ${channels}ch -> ${statSync(out).size} B in ${((Date.now() - t0) / 1000).toFixed(1)} s${cached ? ' (cached)' : ''}`);
}

// A pick the run never encoded must not contribute a silent 0: that under-reports a tier.
const bytesOf = (pick: TexPick): number => {
  const row = files.find((f) => f.file === pickFile(pick));
  if (row === undefined) throw new Error(`no encoded row for ${pickFile(pick)}`);
  return row.bytes;
};
const sumBytes = (tier: readonly TexPick[]) => tier.reduce((n, p) => n + bytesOf(p), 0);
const head2k = TIER2.find((p) => p.key === 'head_bc');
if (head2k === undefined) throw new Error('tier 2 no longer carries a head colour map');
// Tier 2 replaces its keys rather than adding to them: only one size of a key is ever resident.
const swapped = new Set(TIER2.map((p) => p.key));
const budget = {
  tier1Bytes: sumBytes(TIER1),
  tier2Bytes: sumBytes(TIER2),
  tier2HeadBytes: bytesOf(head2k),
  vram: { tier1: textureVramBytes(TIER1), tier2: textureVramBytes([...TIER1.filter((p) => !swapped.has(p.key)), ...TIER2]) },
  files,
};
writeFileSync(resolve(s4, 'ktx2-budget.json'), JSON.stringify(budget, null, 1));
const tier1Files = new Set(TIER1.map(pickFile));
const mb = (n: number) => (n / 1e6).toFixed(2);
const md = ['| file | key | class | recipe | dim | KTX2 B | BC7 B | tier |', '|---|---|---|---|---|---|---|---|',
  ...files.map((f) => `| ${f.file} | ${f.key} | ${planOf(f.key).cls} | ${f.recipe} | ${f.dim} | ${f.bytes} | ${f.gpuBytes} | ${tier1Files.has(f.file) ? '1' : '2'} |`),
  '', `Tier 1: ${budget.tier1Bytes} B (${mb(budget.tier1Bytes)} MB) over the wire, ${budget.vram.tier1} B resident at BC7.`,
  `Tier 2 swaps: ${budget.tier2Bytes} B (${mb(budget.tier2Bytes)} MB) over the wire; with them resident the set is ${budget.vram.tier2} B at BC7.`,
  `${files.length} files encoded and validated.`].join('\n') + '\n';
writeFileSync(resolve(s4, 'ktx2-budget.md'), md);
console.log(md);
