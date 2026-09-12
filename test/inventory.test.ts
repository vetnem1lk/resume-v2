// The inventory summary is what the design numbers are read from; pin its arithmetic.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { moduleSet, morphRanking, rows, toMarkdown, type InventoryFile } from '../src/pipeline/inventory.ts';
import { ARKIT_52, EYE_LOOK, KEEP_18, KEEP_24, KEEP_SPEC, SHIP_24, TIERS } from '../src/pipeline/morphs.ts';

const inv = JSON.parse(readFileSync(new URL('./fixtures/inventory-mini.json', import.meta.url), 'utf8')) as InventoryFile[];

test('one row per mesh, counting morphs and bound bones', () => {
  const r = rows(inv);
  expect(r).toHaveLength(3);
  expect(r[0]).toMatchObject({ file: 'SK_MechanicGirl_03.fbx', object: 'SK_MECHANICGIRL_HEAD', verts: 10, tris: 16, morphs: 2, bones: 1 });
});

test('module set totals sum a file and union its bound bones', () => {
  const s = moduleSet(inv, 'SK_MechanicGirl_03.fbx');
  expect(s.verts).toBe(30);
  expect(s.tris).toBe(46);
  expect(s.boundBones).toEqual(['head', 'pelvis']);
});

test('morph ranking is by max delta in millimetres, descending', () => {
  const m = morphRanking(inv, 'SK_MechanicGirl_03.fbx', 'SK_MECHANICGIRL_HEAD');
  expect(m.map((x) => x.name)).toEqual(['jawOpen', 'tongueOut']);
  expect(m[0].maxDeltaMm).toBeCloseTo(21, 5);
});

test('keep-lists are ARKit names, nested, and never contain eyeLook', () => {
  expect(ARKIT_52).toHaveLength(52);
  expect(new Set(ARKIT_52).size).toBe(52);
  expect(KEEP_SPEC).toHaveLength(15);
  expect(KEEP_18).toHaveLength(18);
  expect(KEEP_24).toHaveLength(24);
  for (const list of [KEEP_SPEC, KEEP_18, KEEP_24]) for (const n of list) expect(ARKIT_52).toContain(n);
  expect(KEEP_SPEC.every((n) => KEEP_18.includes(n) && KEEP_24.includes(n))).toBe(true);
  expect(EYE_LOOK).toHaveLength(8);
  expect(KEEP_24.some((n) => EYE_LOOK.includes(n))).toBe(false);
});

test('markdown carries the module-set header and one line per object of that set only', () => {
  const set = moduleSet(inv, 'SK_MechanicGirl_03.fbx');
  const md = toMarkdown({ set, rows: set.objects, ranking: morphRanking(inv, 'SK_MechanicGirl_03.fbx', 'SK_MECHANICGIRL_HEAD') });
  expect(md).toContain('| SK_MECHANICGIRL_HEAD | 10 | 16 | 2 |');
  expect(md).toContain('30 verts');
  // The other file also holds a SK_MECHANICGIRL_HEAD: rows under the header must be this set's.
  expect(md.match(/^\| SK_MECHANICGIRL_/gm)).toHaveLength(2);
});

test('the shipped 24 are KEEP_18 plus six named shapes, all ARKit names, none an eyeLook', () => {
  expect(SHIP_24).toHaveLength(24);
  expect(new Set(SHIP_24).size).toBe(24);
  expect(SHIP_24.slice(0, 18)).toEqual(KEEP_18);
  expect(SHIP_24.slice(18)).toEqual(['mouthClose', 'mouthLeft', 'mouthRight', 'cheekPuff', 'browOuterUpLeft', 'browOuterUpRight']);
  for (const name of SHIP_24) expect(ARKIT_52).toContain(name);
  expect(SHIP_24.some((n) => n.startsWith('eyeLook'))).toBe(false);
  expect(TIERS.ship24).toBe(SHIP_24);
});
