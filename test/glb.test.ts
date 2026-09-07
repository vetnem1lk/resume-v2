// The budget table is what the spec quotes; pin its arithmetic on a hand-made accounting.
import { expect, test } from 'vitest';
import { formatBudget, type Accounting } from '../src/pipeline/glb.ts';

const a: Accounting = {
  meshes: [{ name: 'HEAD', prims: 1, verts: 9000, tris: 8900, targets: 15, baseBytes: 100000, morphBytes: 1620000 }],
  animations: [{ name: 'Idle', channels: 300, keyframes: 130, bytes: 90000, seconds: 4.333 }],
  textures: [],
  totals: { mesh: 100000, morph: 1620000, anim: 90000, tex: 0, other: 5000, decoded: 1815000, disk: 400000 },
};

test('formatter prints per-mesh, per-clip (bytes per second) and totals with the on-disk size', () => {
  const md = formatBudget(a);
  expect(md).toContain('| HEAD | 1 | 9000 | 8900 | 15 |');
  expect(md).toContain('| Idle | 300 | 130 | 90000 | 4.33 | 20771 |');
  expect(md).toContain('on disk 400000 B');
});
