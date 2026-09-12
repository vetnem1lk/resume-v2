// Builds the served subset: the Blender assemble, then gltf-transform wires the pre-encoded tier-1
// KTX2 files onto the exported materials, fixes the alpha, face and metal rules, compresses with
// meshopt and validates, and writes one immutable build directory plus the assets.ts block to pin.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { account, sizes } from '../../src/pipeline/glb.ts';
import { TIER1, TIER1_PICK, TIER2, pickFile } from '../../src/pipeline/ktx.ts';
import { LOOK } from '../../src/pipeline/look.ts';
import { TIERS } from '../../src/pipeline/morphs.ts';
import { shippingClips } from './clip-sources.ts';
import { openGltf, type GltfTexture } from './gltf.ts';
import { manifest } from './manifest.ts';
import { PATHS, REPO_ROOT, requireTool } from './paths.ts';
import { runBlender } from './run-blender.ts';

const s4 = resolve(PATHS.build, 's4');
const ktx2Dir = resolve(s4, 'ktx2');
const workDir = resolve(s4, 'assemble');
mkdirSync(workDir, { recursive: true });
shippingClips(['Idle']);                                       // the registry gate: refuses an unregistered clip
const idleFbx = resolve(s4, 'idle', 'Idle.fbx');
if (!existsSync(idleFbx)) throw new Error(`run pipeline:idle first: ${idleFbx}`);
const shipFile = resolve(workDir, 'ship24.json');
writeFileSync(shipFile, JSON.stringify(TIERS.ship24));

// 1. Blender: the joined look at SHIP_24 with the idle baked, as a float32 twin.
const { sentinel } = await runBlender(resolve(REPO_ROOT, 'scripts/pipeline/blender/assemble.py'), [resolve(PATHS.raw, 'mg_fbx', 'SK_MechanicGirl_03.fbx'), idleFbx, workDir, shipFile]);
if (!sentinel?.startsWith('S4_ASSEMBLE_OK')) throw new Error(`assemble: ${sentinel}`);
const base = resolve(workDir, 'look_ship24_base.glb');
// The CLI's executable is its bin script, one level above the vendored tree GLTF_MODULES names.
const gltfTransform = requireTool('gltf-transform', resolve(PATHS.gltfModules, '..', 'bin', 'cli.js'), 'GLTF_MODULES');

/** What the bundled validator (gltf-validator 2.0.0-dev) reports that is not a defect: it predates
 *  KHR_texture_basisu and KHR_materials_anisotropy, so the KTX2 mime type and both extensions read
 *  as invalid, and it counts a tangent-less normal-mapped primitive and an unreferenced attribute.
 *  Anything else at error or warning severity fails the build. */
const ALLOWED = new Set(['VALUE_NOT_IN_LIST', 'IMAGE_UNRECOGNIZED_FORMAT', 'UNSUPPORTED_EXTENSION',
  'MESH_PRIMITIVE_GENERATED_TANGENT_SPACE', 'UNUSED_OBJECT', 'NODE_EMPTY', 'NODE_SKINNED_MESH_NON_ROOT']);

/** 4.4.2 has no `--format json`; csv is its only machine-readable table. */
function validate(file: string, label: string): void {
  let csv: string;
  let threw: unknown;
  try {
    csv = execFileSync('node', [gltfTransform, 'validate', file, '--format', 'csv'], { encoding: 'utf8' });
  } catch (err) {
    threw = err;
    csv = String((err as { stdout?: string }).stdout ?? '');   // the CLI prints the table, then exits non-zero on an error
  }
  // code,message,severity,pointer - the message is quoted and may carry commas; the pointer never does.
  const issues = csv.split(/\r?\n/).flatMap((line) => {
    const m = /^([A-Z_0-9]+),.*,(\d+),[^,]*$/.exec(line);
    return m === null ? [] : [{ code: m[1] ?? '', severity: Number(m[2]) }];
  });
  // A failed run that produced no table (missing file, renamed flag, a crash) is a failed run, not
  // a clean file: a green validation needs the table as its evidence.
  if (threw !== undefined && issues.length === 0) throw threw;
  const counts = new Map<string, number>();
  for (const issue of issues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  console.log(`validate ${label}: ${[...counts].map(([code, n]) => `${n}x${code}`).join(' ') || 'no issues'}`);
  const bad = issues.filter((i) => i.severity <= 1 && !ALLOWED.has(i.code));
  if (bad.length > 0) throw new Error(`validate ${label}: ${JSON.stringify(bad)}`);
}

validate(base, 'twin');

// 2. gltf-transform: the look, the extensions, the compression.
const { io, fn, ext, encoder } = await openGltf(PATHS.gltfModules);
const doc = await io.read(base);
doc.createExtension(ext.KHRTextureBasisu).setRequired(true);
const anisotropyExt = doc.createExtension(ext.KHRMaterialsAnisotropy);
const cache = new Map<string, GltfTexture>();
const texture = (key: string): GltfTexture => {
  const hit = cache.get(key);
  if (hit) return hit;
  const dim = TIER1_PICK[key];
  if (dim === undefined) throw new Error(`no tier-1 size for ${key}`);
  const pick = TIER1.find((p) => p.key === key);
  if (pick === undefined) throw new Error(`no tier-1 pick for ${key}`);
  const made = doc.createTexture(key).setMimeType('image/ktx2').setImage(readFileSync(resolve(ktx2Dir, pickFile(pick))));
  cache.set(key, made);
  return made;
};
for (const material of doc.getRoot().listMaterials()) {
  const look = LOOK[material.getName()];
  if (!look) throw new Error(`the export carries a material the look does not cover: ${material.getName()}`);
  material.setBaseColorFactor([1, 1, 1, 1]).setBaseColorTexture(texture(look.base)).setAlphaMode(look.alphaMode).setDoubleSided(look.doubleSided).setMetallicFactor(look.metallic).setRoughnessFactor(1);
  if (look.cutoff !== undefined) material.setAlphaCutoff(look.cutoff);
  if (look.normal !== undefined) material.setNormalTexture(texture(look.normal));
  if (look.orm !== undefined) material.setOcclusionTexture(texture(look.orm)).setMetallicRoughnessTexture(texture(look.orm));
  if (look.anisotropy !== undefined) material.setExtension('KHR_materials_anisotropy', anisotropyExt.createAnisotropy().setAnisotropyStrength(look.anisotropy));
}
await doc.transform(
  fn.prune({ keepAttributes: true } as never) as never,      // default prune drops TEXCOORD_0 before the maps are wired
  fn.dedup({ keepUniqueNames: true } as never) as never,     // default dedup erases MAT_EYE_L
  fn.meshopt({ encoder, level: 'high', quantizationVolume: 'scene' } as never) as never,  // one skin, not seventeen
);
const glb = await io.writeBinary(doc);
if (doc.getRoot().listAnimations().map((a) => a.getName()).join() !== 'Idle') throw new Error('the Idle clip did not survive the transform');

// 3. The immutable build directory.
const build = `s4-${createHash('sha256').update(glb).digest('hex').slice(0, 8)}`;
const out = resolve(s4, 'deploy', 'g2', 'v2', build);
mkdirSync(resolve(out, 'tex'), { recursive: true });
writeFileSync(resolve(out, 'mg.glb'), glb);
for (const pick of TIER2) copyFileSync(resolve(ktx2Dir, pickFile(pick)), resolve(out, 'tex', pickFile(pick)));
const files = [
  { file: resolve(out, 'mg.glb'), path: `/g2/v2/${build}/mg.glb`, compressible: true },
  ...TIER2.map((p) => ({ file: resolve(out, 'tex', pickFile(p)), path: `/g2/v2/${build}/tex/${pickFile(p)}`, compressible: false })),
];
const tool = { blender: '5.2.0', gltfTransform: '4.4.2', ktx: '4.4.2' };
const m = manifest(files, tool, build);
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(m, null, 1));

// 4. Validation on the embedded file.
validate(resolve(out, 'mg.glb'), build);

// 5. The accounting and the block to pin. The accounting stays in the work directory: the build
// directory is exactly what the manifest enumerates and the host serves.
const acc = account(await io.read(resolve(out, 'mg.glb')), sizes(resolve(out, 'mg.glb')), fn);
writeFileSync(resolve(workDir, `${build}-accounting.json`), JSON.stringify(acc, null, 1));
console.log(`\nbuild ${build}: disk ${m.files[0]?.disk} B, wire ${m.files[0]?.wire} B, textures ${acc.totals.tex} B, tris ${acc.meshes.reduce((n, r) => n + r.tris, 0)}`);
console.log(`\n// src/scene/assets.ts\nexport const ASSET_BASE = '/g2/v2/${build}/';\nexport const GLB = { url: \`\${ASSET_BASE}mg.glb\`, bytes: ${glb.byteLength} } as const;`);
