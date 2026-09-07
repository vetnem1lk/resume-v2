// The tier-1 number: geometry per morph tier + the idle clip + the tier-1 texture pick, on disk and
// over the wire, from measured files. Also splits the price of body motion into per-channel glTF
// JSON and per-second keyframe bytes, and sums morph VRAM per tier.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { account, formatBudget, openIO, sizes } from '../../src/pipeline/glb.ts';
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
const tiers: Record<string, { disk: number; transfer: number; decoded: number; morph: number; joints: number; headPositionCount: number; headPrims: number; headTargets: number }> = {};
const geoSize: Record<string, ReturnType<typeof sizes>> = {};
for (const tier of ['spec15', 'keep18', 'keep24', 'all52']) {
  const file = resolve(measureDir, `geo_${tier}.glb`);
  const e = measure.exports[tier].meshopt;
  geoSize[tier] = sizes(file);
  const acc = account(await io.read(file), geoSize[tier], fn);
  tiers[tier] = { disk: acc.totals.disk, transfer: acc.totals.transfer, decoded: acc.totals.decoded, morph: acc.totals.morph, joints: e.joints, headPositionCount: e.head_position_count, headPrims: e.head_prims, headTargets: e.head_targets };
  md.push(`## geo_${tier}.glb`, '', formatBudget(acc));
}
const clipsFile = resolve(measureDir, 'clips_spec15.glb');
const clipsSize = sizes(clipsFile);
const clipsAcc = account(await io.read(clipsFile), clipsSize, fn);
const clipsDiskDelta = clipsSize.disk - geoSize.spec15.disk;
// A clip costs glTF JSON (one sampler + one channel + two accessors + two bufferViews per bone
// track, so it scales with CHANNELS) plus meshopt keyframe bytes in the BIN chunk (which scale with
// seconds). Prorating the whole delta by keyframe bytes bills the long clip for the short ones' JSON.
const clipsJsonDelta = clipsSize.json - geoSize.spec15.json;
const clipsBinDelta = clipsSize.bin - geoSize.spec15.bin;
const clipsTransferDelta = clipsSize.transfer - geoSize.spec15.transfer;
const totalChannels = clipsAcc.animations.reduce((n, a) => n + a.channels, 0);
const jsonShare = (a: { channels: number }) => (totalChannels > 0 ? Math.round(clipsJsonDelta * (a.channels / totalChannels)) : 0);
const binShare = (a: { bytes: number }) => (clipsAcc.totals.anim > 0 ? Math.round(clipsBinDelta * (a.bytes / clipsAcc.totals.anim)) : 0);
const diskShare = (a: { channels: number; bytes: number }) => jsonShare(a) + binShare(a);
// Brotli collapses the repetitive JSON, so the wire delta is measured once for the set and split
// proportionally: no per-clip export exists to measure it against.
const wireShare = (a: { channels: number; bytes: number }) => (clipsDiskDelta > 0 ? Math.round(clipsTransferDelta * (diskShare(a) / clipsDiskDelta)) : 0);
const clips = { disk: clipsSize.disk, transfer: clipsSize.transfer, animations: clipsAcc.animations, bake: measure.clips, geometryDisk: geoSize.spec15.disk, geometryTransfer: geoSize.spec15.transfer, clipsDiskDelta, clipsJsonDelta, clipsBinDelta, clipsTransferDelta };
md.push('## clips_spec15.glb (spec15 geometry + five clips)', '', formatBudget(clipsAcc),
  '## Body clips (JSON per channel-set, BIN per keyframe share, wire = brotli-11)', '',
  `five clips add ${clipsDiskDelta} B on disk = ${clipsJsonDelta} B of glTF JSON + ${clipsBinDelta} B of meshopt keyframes, and ${clipsTransferDelta} B over the wire`, '',
  '| clip | s | frames baked | channels | decoded B | JSON B | keyframe B | keyframe B/s | disk B | wire B |', '|---|---|---|---|---|---|---|---|---|---|',
  ...clipsAcc.animations.map((a) => `| ${a.name} | ${a.seconds.toFixed(2)} | ${measure.clips[a.name]?.frames.join('..') ?? '-'} | ${a.channels} | ${a.bytes} | ${jsonShare(a)} | ${binShare(a)} | ${a.seconds > 0 ? Math.round(binShare(a) / a.seconds) : 0} | ${diskShare(a)} | ${wireShare(a)} |`), '');

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
const idleShare = diskShare(idle);
const idleWire = wireShare(idle);
const total = tiers.spec15.disk + idleShare + ktx.tier1Bytes;
// KTX2 payloads are already compressed (brotli moves them by a handful of bytes), so only the GLB
// half of the download shrinks; this transfer total is the one the loader-wait gate reads.
const totalTransfer = tiers.spec15.transfer + idleWire + ktx.tier1Bytes;
const tier1 = { geometryDisk: tiers.spec15.disk, geometryTransfer: tiers.spec15.transfer, idleDiskEstimate: idleShare, idleTransferEstimate: idleWire, texturesTier1: ktx.tier1Bytes, total, totalTransfer, tier2Head: ktx.tier2HeadBytes };
md.push('## Tier-1 GLB (spec15 geometry + idle + tier-1 KTX2 pick)', '',
  `on disk: geometry ${tiers.spec15.disk} B + idle ~${idleShare} B + textures ${ktx.tier1Bytes} B = **${total} B (${MB(total)})**`,
  `over the wire: geometry ${tiers.spec15.transfer} B + idle ~${idleWire} B + textures ${ktx.tier1Bytes} B = **${totalTransfer} B (${MB(totalTransfer)})**`,
  `tier-2 head BC 2048 sidecar +${ktx.tier2HeadBytes} B`);

writeFileSync(resolve(s2, 'tier1-budget.json'), JSON.stringify({ tiers, clips, vram, tier1 }, null, 1));
writeFileSync(resolve(s2, 'tier1-budget.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
