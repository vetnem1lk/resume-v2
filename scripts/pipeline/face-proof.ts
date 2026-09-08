// Face proof end to end: UE writes the FBX with blend-shape curves, Blender proves the curves
// and exports the GLB, the GLB is copied next to the bare viewer. Never runs two editors at once.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PATHS, REPO_ROOT } from './paths.ts';
import { runBlender } from './run-blender.ts';
import { runUe } from './run-ue.ts';

const s2 = resolve(PATHS.build, 's2');
mkdirSync(s2, { recursive: true });
const fbx = resolve(s2, 'face_proof.fbx');
const glb = resolve(s2, 'face_proof.glb');
const report = resolve(s2, 'face_proof.json');
process.env.S2_FACE_FBX = fbx.replace(/\\/g, '/');

const ue = await runUe(resolve(REPO_ROOT, 'scripts/pipeline/ue/face_proof_synth.py'), resolve(s2, 'face_proof.log'), [fbx]);
console.log('UE:', JSON.stringify(ue));
const curves = (ue.curves as string[]).join(',');

const { sentinel } = await runBlender(resolve(REPO_ROOT, 'scripts/pipeline/blender/face_proof.py'), [fbx, glb, report, curves]);
if (!sentinel?.startsWith('S2_FACE_PROOF_OK')) throw new Error(`face proof: ${sentinel}`);
const r = JSON.parse(readFileSync(report, 'utf8')) as { verdict: string; checks: Record<string, unknown> };
console.log('Blender:', JSON.stringify(r.checks));

const llf = await runBlender(resolve(REPO_ROOT, 'scripts/pipeline/blender/llf_csv.py'), [fbx, 'selftest', '30']);
console.log('CSV fallback self-test:', llf.sentinel);

mkdirSync(resolve(REPO_ROOT, 'tools/assets'), { recursive: true });
copyFileSync(glb, resolve(REPO_ROOT, 'tools/assets/face-proof.glb'));
console.log(`verdict: ${r.verdict}; open tools/face-proof.html through the dev server`);
