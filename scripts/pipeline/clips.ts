// The tier-1 number: geometry per morph tier + the idle clip + the tier-1 texture pick, from
// measured files. Also prices body motion per clip-second and morph VRAM per tier.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { account, formatBudget, openIO } from '../../src/pipeline/glb.ts';
import { TIERS } from '../../src/pipeline/morphs.ts';
import { MB, morphTextureBytes, naiveBytes, type Slots } from '../../src/pipeline/vram.ts';
import { PATHS, REPO_ROOT } from './paths.ts';
import { runBlender } from './run-blender.ts';
import { runUe } from './run-ue.ts';

// Every morphed primitive gets its own morph texture in three.js, so the VRAM sum walks the
// exported POSITION counts of all of them; 16384 is the WebGL2 limit the viewer HUD reports.
const MAX_TEX = 16384;
interface Morphed { name: string; targets: number; positions: number[] }
interface Described { joints: number; head_position_count: number; head_prims: number; head_targets: number; morphed: Morphed[] }
interface Measure { exports: Record<string, { meshopt: Described }>; clips: Record<string, { frames: number[] }> }

const s2 = resolve(PATHS.build, 's2');
const clipsDir = resolve(s2, 'clips');
const measureDir = resolve(s2, 'measure');
mkdirSync(measureDir, { recursive: true });
const CLIPS = ['Idle', 'Pose_01', 'Pose_02', 'Walk_Fwd', 'Run_Fwd'];
if (CLIPS.some((c) => !existsSync(resolve(clipsDir, `${c}.fbx`)))) {
  process.env.S2_CLIPS_OUT = clipsDir.replace(/\\/g, '/');
  console.log('UE clips:', JSON.stringify(await runUe(resolve(REPO_ROOT, 'scripts/pipeline/ue/export_clips.py'), resolve(s2, 'clips.log'), CLIPS.map((c) => resolve(clipsDir, `${c}.fbx`)))));
}
const tiersFile = resolve(s2, 'tiers.json');
writeFileSync(tiersFile, JSON.stringify({ spec15: TIERS.spec15, keep18: TIERS.keep18, keep24: TIERS.keep24 }));
const combine = resolve(PATHS.raw, 'mg_fbx', 'SK_MechanicGirl_03.fbx');
const { sentinel } = await runBlender(resolve(REPO_ROOT, 'scripts/pipeline/blender/measure.py'), [combine, clipsDir, measureDir, tiersFile]);
if (!sentinel?.startsWith('S2_MEASURE_OK')) throw new Error(`measure: ${sentinel}`);
const measure = JSON.parse(readFileSync(resolve(measureDir, 'measure.json'), 'utf8')) as Measure;

const { io, fn } = await openIO(PATHS.gltfModules);
const md: string[] = [];
const tiers: Record<string, { disk: number; decoded: number; morph: number; joints: number; headPositionCount: number; headPrims: number; headTargets: number }> = {};
for (const tier of ['spec15', 'keep18', 'keep24', 'all52']) {
  const file = resolve(measureDir, `geo_${tier}.glb`);
  const e = measure.exports[tier].meshopt;
  const acc = account(await io.read(file), statSync(file).size, fn);
  tiers[tier] = { disk: acc.totals.disk, decoded: acc.totals.decoded, morph: acc.totals.morph, joints: e.joints, headPositionCount: e.head_position_count, headPrims: e.head_prims, headTargets: e.head_targets };
  md.push(`## geo_${tier}.glb`, '', formatBudget(acc));
}
const clipsFile = resolve(measureDir, 'clips_spec15.glb');
const clipsAcc = account(await io.read(clipsFile), statSync(clipsFile).size, fn);
const clipsDiskDelta = clipsAcc.totals.disk - tiers.spec15.disk;
// The GLB stores all five clips in one meshopt buffer, so a clip's on-disk price is its share of it.
const diskShare = (bytes: number) => (clipsAcc.totals.anim > 0 ? Math.round(clipsDiskDelta * (bytes / clipsAcc.totals.anim)) : 0);
const clips = { disk: clipsAcc.totals.disk, animations: clipsAcc.animations, bake: measure.clips, geometryDisk: tiers.spec15.disk, clipsDiskDelta };
md.push('## clips_spec15.glb (spec15 geometry + five clips)', '', formatBudget(clipsAcc),
  '## Body clips on disk (share of the meshopt clip buffer)', '', '| clip | s | frames baked | decoded B | disk B | disk B/s |', '|---|---|---|---|---|---|',
  ...clipsAcc.animations.map((a) => `| ${a.name} | ${a.seconds.toFixed(2)} | ${measure.clips[a.name]?.frames.join('..') ?? '-'} | ${a.bytes} | ${diskShare(a.bytes)} | ${a.seconds > 0 ? Math.round(diskShare(a.bytes) / a.seconds) : 0} |`), '');

// Morph VRAM: three r185 allocates one RGBA32F morph texture per primitive of every morphed mesh.
const perPrim = (m: Morphed, slots: Slots) => m.positions.reduce((n, c) => n + morphTextureBytes(c, slots, m.targets, MAX_TEX), 0);
const vram = Object.entries(tiers).map(([tier, t]) => {
  const morphed = measure.exports[tier].meshopt.morphed;
  return {
    tier, meshes: morphed.length, headTargets: t.headTargets, totalTargets: morphed.reduce((n, m) => n + m.targets, 0),
    normalsOff: morphed.reduce((n, m) => n + perPrim(m, 1), 0),
    normalsOn: morphed.reduce((n, m) => n + perPrim(m, 2), 0),
    naiveOff: morphed.reduce((n, m) => n + m.positions.reduce((p, c) => p + naiveBytes(c, 1, m.targets), 0), 0),
    headOnlyOff: morphTextureBytes(t.headPositionCount, 1, t.headTargets, MAX_TEX),
  };
});
md.push('## Morph VRAM (POSITION counts from the GLB, three r185 per-primitive textures)', '',
  '| tier | morphed meshes | head targets | all targets | normals off | normals on | naive off | head only, normals off |', '|---|---|---|---|---|---|---|---|',
  ...vram.map((r) => `| ${r.tier} | ${r.meshes} | ${r.headTargets} | ${r.totalTargets} | ${MB(r.normalsOff)} | ${MB(r.normalsOn)} | ${MB(r.naiveOff)} | ${MB(r.headOnlyOff)} |`), '');

const ktx = JSON.parse(readFileSync(resolve(s2, 'ktx2-budget.json'), 'utf8')) as { tier1Bytes: number; tier2HeadBytes: number };
const idle = clipsAcc.animations.find((a) => a.name === 'Idle');
if (!idle) throw new Error('clips_spec15.glb carries no Idle animation');
const idleShare = diskShare(idle.bytes);
const total = tiers.spec15.disk + idleShare + ktx.tier1Bytes;
const tier1 = { geometryDisk: tiers.spec15.disk, idleDiskEstimate: idleShare, texturesTier1: ktx.tier1Bytes, total, tier2Head: ktx.tier2HeadBytes };
md.push('## Tier-1 GLB (spec15 geometry + idle + tier-1 KTX2 pick)', '', `geometry ${tiers.spec15.disk} B + idle ~${idleShare} B + textures ${ktx.tier1Bytes} B = **${total} B (${MB(total)})**; tier-2 head BC 2048 sidecar +${ktx.tier2HeadBytes} B`);

writeFileSync(resolve(s2, 'tier1-budget.json'), JSON.stringify({ tiers, clips, vram, tier1 }, null, 1));
writeFileSync(resolve(s2, 'tier1-budget.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
