// The budget table and the accounting behind it are what the spec quotes; pin both: the table on a
// hand-made accounting, account() on a fake gltf-transform document, sizes() on a hand-built GLB.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { account, formatBudget, sizes, type Accounting } from '../src/pipeline/glb.ts';

const a: Accounting = {
  meshes: [{ name: 'HEAD', prims: 1, verts: 9000, tris: 8900, targets: 15, baseBytes: 100000, morphBytes: 1620000 }],
  animations: [{ name: 'Idle', channels: 300, keyframes: 130, bytes: 90000, seconds: 4.333 }],
  textures: [],
  totals: { mesh: 100000, morph: 1620000, anim: 90000, tex: 0, other: 5000, decoded: 1815000, disk: 400000, transfer: 260000 },
};

test('formatter prints per-mesh, per-clip (bytes per second) and totals with both file sizes', () => {
  const md = formatBudget(a);
  expect(md).toContain('| HEAD | 1 | 9000 | 8900 | 15 |');
  expect(md).toContain('| Idle | 300 | 130 | 90000 | 4.33 | 20771 |');
  expect(md).toContain('on disk 400000 B; over the wire 260000 B');
});

// The vendored library has no local types, so the fake mirrors only the surface account() touches.
const acc = (byteLength: number, count = 0, max = 0) => ({ getByteLength: () => byteLength, getCount: () => count, getMax: () => [max] });
const position = acc(600), indices = acc(120), skin = acc(40), morph = acc(300), position2 = acc(200);
const input = acc(32, 130, 4.5), output = acc(480), orphan = acc(25);
const prim = (attrs: Record<string, unknown>, idx: unknown, targets: unknown[]) =>
  ({ listSemantics: () => Object.keys(attrs), getAttribute: (s: string) => attrs[s], getIndices: () => idx, listTargets: () => targets });
const doc = {
  getRoot: () => ({
    listMeshes: () => [
      { getName: () => 'HEAD', listPrimitives: () => [prim({ POSITION: position, JOINTS_0: skin }, indices, [{ listSemantics: () => ['POSITION'], getAttribute: () => morph }])] },
      { getName: () => '', listPrimitives: () => [prim({ POSITION: position2, JOINTS_0: skin }, null, [])] },
    ],
    listAnimations: () => [{ getName: () => 'Idle', listChannels: () => [0, 1], listSamplers: () => [{ getInput: () => input, getOutput: () => output }] }],
    listTextures: () => [],
    listAccessors: () => [position, indices, skin, morph, position2, input, output, orphan],
  }),
};
const fn = { getGLPrimitiveCount: () => 40, getMeshVertexCount: () => 100 };

test('accounting splits base from morph, dedups a shared accessor onto the first mesh that uses it, and reads clip seconds from the input accessor', () => {
  const t = account(doc, { disk: 5000, transfer: 3000 }, fn).totals;
  expect(t.mesh).toBe(960);                       // 600 + 120 + 40 shared, then 200 (the shared skin accessor is not billed twice)
  expect(t.morph).toBe(300);
  expect(t.anim).toBe(512);
  expect(t.other).toBe(25);                       // only the accessor no mesh or sampler referenced
  expect(t.decoded).toBe(1797);
  expect(t.disk).toBe(5000);
  expect(t.transfer).toBe(3000);

  const r = account(doc, { disk: 5000, transfer: 3000 }, fn);
  expect(r.meshes.map((m) => [m.name, m.baseBytes, m.morphBytes, m.targets])).toEqual([['HEAD', 760, 300, 1], ['(unnamed)', 200, 0, 0]]);
  expect(r.animations[0]).toEqual({ name: 'Idle', channels: 2, keyframes: 130, bytes: 512, seconds: 4.5 });
});

const chunk = (b: Buffer, type: number) => { const h = Buffer.alloc(8); h.writeUInt32LE(b.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, b]); };

test('sizes reads the GLB chunk table and a brotli-11 transfer size', () => {
  const json = Buffer.from('{"asset":{"version":"2.0"}}                 ');   // padded to 4 bytes
  const bin = Buffer.alloc(64, 7);
  const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + json.length + bin.length, 8);
  const glb = Buffer.concat([head, chunk(json, 0x4e4f534a), chunk(bin, 0x004e4942)]);
  const file = join(tmpdir(), 'glb-sizes.test.glb');
  writeFileSync(file, glb);
  const s = sizes(file);
  expect([s.json, s.bin, s.disk]).toEqual([json.length, 64, glb.length]);
  expect(s.transfer).toBeGreaterThan(0);
  expect(s.transfer).toBeLessThan(glb.length);
});
