// The morph VRAM gate (spec section 5) is computed here; pin the formula against three r185's
// WebGLMorphtargets allocation, including the row wrap the naive formula misses.
import { expect, test } from 'vitest';
import { MB, morphTextureBytes, naiveBytes, vramTable } from '../src/pipeline/vram.ts';

test('below the wrap the exact and naive formulas agree (spec example: 9249 verts, 14 targets, no normals)', () => {
  expect(naiveBytes(9249, 1, 14)).toBe(9249 * 16 * 14);
  expect(morphTextureBytes(9249, 1, 14)).toBe(9249 * 16 * 14);
  expect(MB(morphTextureBytes(9249, 1, 14))).toBe('2.07 MB');
});

test('past maxTextureSize the texture wraps to full rows (10000 verts x 2 slots x 52 targets)', () => {
  // width 20000 > 16384 -> 16384 x 2 rows -> 32768 texels x 16 B x 52
  expect(morphTextureBytes(10000, 2, 52)).toBe(16384 * 2 * 16 * 52);
  expect(morphTextureBytes(10000, 2, 52)).toBeGreaterThan(naiveBytes(10000, 2, 52));
  expect(MB(morphTextureBytes(10000, 2, 52))).toBe('27.26 MB');
});

test('WebGPU wraps at 4096 and is cheaper for the same head', () => {
  expect(morphTextureBytes(10000, 2, 52, 4096)).toBe(4096 * 5 * 16 * 52);
});

test('tier table reports normals off and on for every tier', () => {
  const t = vramTable(9249, { spec15: 15, keep18: 18, all52: 52 });
  expect(t.map((r) => r.tier)).toEqual(['spec15', 'keep18', 'all52']);
  expect(t[0].normalsOff).toBe(morphTextureBytes(9249, 1, 15));
  expect(t[0].normalsOn).toBe(morphTextureBytes(9249, 2, 15));
  expect(t[2].normalsOff).toBe(morphTextureBytes(9249, 1, 52));
});
