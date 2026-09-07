// Runs the Blender inventory over the whole package, then writes inventory.json (all files) and
// inventory.md (module set _03 + morph ranking) next to the per-file JSONs.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { moduleSet, morphRanking, rows, toMarkdown, type InventoryFile } from '../../src/pipeline/inventory.ts';
import { PATHS, REPO_ROOT } from './paths.ts';
import { runBlender } from './run-blender.ts';

const LOOK = 'SK_MechanicGirl_03.fbx';
const HEAD = 'SK_MECHANICGIRL_HEAD';
const fbxRoot = resolve(PATHS.raw, 'mg_fbx');
const outDir = resolve(PATHS.build, 'inventory');
mkdirSync(outDir, { recursive: true });
const files = [
  ...readdirSync(fbxRoot).filter((f) => f.endsWith('.fbx')).map((f) => resolve(fbxRoot, f)),
  ...readdirSync(resolve(fbxRoot, 'SeparatedMesh')).filter((f) => f.endsWith('.fbx')).map((f) => resolve(fbxRoot, 'SeparatedMesh', f)),
];
const { sentinel } = await runBlender(resolve(REPO_ROOT, 'scripts/pipeline/blender/inventory.py'), [outDir, ...files]);
if (sentinel !== `S2_INVENTORY_DONE ${files.length}`) throw new Error(`inventory sentinel: ${sentinel}`);

const inv: InventoryFile[] = readdirSync(outDir).filter((f) => f.endsWith('.json') && f !== 'inventory.json')
  .map((f) => JSON.parse(readFileSync(resolve(outDir, f), 'utf8')) as InventoryFile);
writeFileSync(resolve(outDir, 'inventory.json'), JSON.stringify(inv, null, 1));
const md = toMarkdown({ set: moduleSet(inv, LOOK), rows: rows(inv), ranking: morphRanking(inv, LOOK, HEAD) });
writeFileSync(resolve(outDir, 'inventory.md'), md);
console.log(md);
