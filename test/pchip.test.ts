// The anchor interpolant must pass through every key, never overshoot and stay monotone when
// the keys are: a camera height that dips below the next section's anchor reads as a bounce.
import { expect, test } from 'vitest';
import { pchip, pchipSlopes, sanitizeKeys } from '../src/scene/pchip.ts';

const XS = [0.016, 0.157, 0.313, 0.49, 0.625, 0.724, 0.837, 0.972];
const YS = [1.7, 1.3, 1.0, 0.85, 0.48, 0.25, 0.05, 0];

test('passes through every key exactly', () => {
  const y = pchip(XS, YS);
  XS.forEach((x, i) => expect(y(x)).toBe(YS[i]));
});

test('is non-increasing over a decreasing table and never overshoots', () => {
  const y = pchip(XS, YS);
  let prev = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 4000; i += 1) {
    const v = y(i / 4000);
    expect(v).toBeLessThanOrEqual(prev + 1e-12);
    expect(v).toBeGreaterThanOrEqual(-1e-12);
    expect(v).toBeLessThanOrEqual(1.7 + 1e-12);
    prev = v;
  }
});

test('holds a plateau flat and clamps outside the range', () => {
  const y = pchip([0, 1, 2, 3, 4], [0, 3, 3, 3, 3]);
  expect(y(2.5)).toBeCloseTo(3, 12);
  expect(y(-5)).toBe(0);
  expect(y(9)).toBe(3);
  expect([...pchipSlopes([0, 1, 2, 3, 4], [0, 3, 3, 3, 3])].slice(1)).toEqual([0, 0, 0, 0]);
});

test('two keys degenerate to a line', () => {
  const y = pchip([0, 1], [1, 3]);
  expect(y(0.5)).toBeCloseTo(2, 12);
});

test('rejects fewer than two keys or keys that do not advance', () => {
  expect(() => pchip([1], [1])).toThrow(/two keys/);
  expect(() => pchip([0, 0], [1, 2])).toThrow(/increasing/);
});

test('sanitizeKeys drops non-finite keys and ties, keeping the first', () => {
  const keys = sanitizeKeys([
    { id: 'a', u: -0.02, y: 1.7 }, { id: 'b', u: 0.3, y: 1 }, { id: 'c', u: 0.3, y: 0.8 },
    { id: 'd', u: Number.NaN, y: 0.5 }, { id: 'e', u: 0.2, y: 0.4 }, { id: 'f', u: 1.04, y: 0 },
  ]);
  expect(keys.map((k) => k.id)).toEqual(['a', 'b', 'f']);
});
