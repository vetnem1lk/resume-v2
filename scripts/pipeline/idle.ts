// The engine idle onto the pack skeleton: back up the assets the compatible-skeleton write touches,
// copy the two template assets into the project, export the clip bones-only with the pack mesh
// pinned, then measure how far the clip rig is from the look. Writes outside the repository only.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clipSource } from './clip-sources.ts';
import { PATHS, REPO_ROOT, requireTool } from './paths.ts';
import { runBlender } from './run-blender.ts';
import { runUe } from './run-ue.ts';
import { copyMannequinTemplate } from './ue-template.ts';

const project = PATHS.ueProject;
if (project === null) throw new Error('UE_PROJECT is required (the .uproject of the character project)');
const projectDir = resolve(project, '..');
requireTool('Unreal editor', PATHS.ueCmd, 'UE_CMD');
const s4 = resolve(PATHS.build, 's4');
const idleDir = resolve(s4, 'idle');
mkdirSync(idleDir, { recursive: true });

// Step 0 (founder-approved): the compatible-skeleton call can write the pack skeleton, so copy that
// asset first; the export script refuses the write unless the job names this same backed-up asset.
const PACK_MESH = '/Game/IdaFaber/Meshes/Girl/SK_MechanicGirl_03';
const PACK_SKELETON = '/Game/IdaFaber/Meshes/Girl/SKEL_UE5_F';
const skeletonFile = `Content/${PACK_SKELETON.slice('/Game/'.length)}.uasset`;
const backup = resolve(s4, 'backup', skeletonFile);
if (!existsSync(backup)) { mkdirSync(resolve(backup, '..'), { recursive: true }); cpSync(resolve(projectDir, skeletonFile), backup); }

const idle = clipSource('Idle');
console.log('template copy:', JSON.stringify(copyMannequinTemplate(PATHS.ueEngine, projectDir)));
const fbx = resolve(idleDir, 'Idle.fbx');
process.env.S2_CLIPS_JOB = JSON.stringify({ out: idleDir.replace(/\\/g, '/'), allow_skeleton_write: PACK_SKELETON, clips: { Idle: { asset: idle.assetPath, mesh: PACK_MESH } } });
const log = resolve(idleDir, 'idle.log');
const ue = await runUe(resolve(REPO_ROOT, 'scripts/pipeline/ue/export_clips.py'), log, [fbx]) as Record<string, { ok: boolean; bytes: number; frames: number; keys: number; fps: number; root_motion: boolean; mesh_skeleton: string }>;
const got = ue.Idle;
if (!got?.ok || got.bytes === 0 || /preview mesh is not set/i.test(readFileSync(log, 'utf8'))) throw new Error(`idle export failed: ${JSON.stringify(got)}`);
// The run has to prove the backup covered the asset the write could touch.
if (got.mesh_skeleton.split('.')[0] !== PACK_SKELETON) throw new Error(`the pinned mesh sits on ${got.mesh_skeleton}, not the backed-up ${PACK_SKELETON}`);
const want = idle.measured;
if (want && (got.frames !== want.frames || got.keys !== want.keys || Math.round(got.fps) !== want.fps || got.root_motion !== want.rootMotion)) {
  throw new Error(`idle export disagrees with the registry: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
}

const parityFile = resolve(idleDir, 'parity.json');
const { sentinel } = await runBlender(resolve(REPO_ROOT, 'scripts/pipeline/blender/rig_parity.py'), [resolve(PATHS.raw, 'mg_fbx', 'SK_MechanicGirl_03.fbx'), fbx, parityFile]);
if (!sentinel?.startsWith('S2_PARITY_OK')) throw new Error(`parity: ${sentinel}`);
// Pinning the look's own mesh makes both rigs share a rest pose, so rest lengths cannot decide the
// bake; the baked translations, which stay the source rig's, can.
const parity = JSON.parse(readFileSync(parityFile, 'utf8')) as { median_rel_len_delta: number; worst_rel_len_delta: number; worst_bone: string; median_rel_translation_delta: number };
writeFileSync(resolve(idleDir, 'idle.json'), JSON.stringify({ ue, parity, bake: parity.median_rel_translation_delta > 0.01 ? 'rotation-only' : 'copy-transforms' }, null, 1));
console.log('idle:', JSON.stringify(got), 'parity:', JSON.stringify(parity));
