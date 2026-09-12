// The mark must sit exactly where CSS puts it at the top (no jump when the island boots), turn
// and rise monotonically with the scroll, and come to rest at both ends.
import { expect, test } from 'vitest';
import { LETTERFORM_DEFAULTS, letterformPose, letterformVars, smoothstep } from '../src/scene/letterform.ts';

test('rests at the top: the static mark and the live mark coincide', () => {
  const p = letterformPose(0);
  expect(p.rotate).toBeCloseTo(0, 12);
  expect(p.rise).toBeCloseTo(0, 12);
  expect(p.scale).toBeCloseTo(1, 12);
});

test('reaches the full turn, rise and zoom at the bottom, and is clamped beyond', () => {
  expect(letterformPose(1)).toEqual({ rotate: -90, rise: 0.18, scale: 1.12 });
  expect(letterformPose(1.5)).toEqual(letterformPose(1));
  expect(letterformPose(-1)).toEqual(letterformPose(0));
});

test('turns and rises monotonically, with zero speed at both ends', () => {
  let prev = letterformPose(0);
  for (let i = 1; i <= 200; i += 1) {
    const p = letterformPose(i / 200);
    expect(p.rotate).toBeLessThanOrEqual(prev.rotate);
    expect(p.rise).toBeGreaterThanOrEqual(prev.rise);
    prev = p;
  }
  expect(smoothstep(0.5)).toBeCloseTo(0.5, 12);
  expect(smoothstep(0.01) / 0.01).toBeLessThan(0.05);
  expect((1 - smoothstep(0.99)) / 0.01).toBeLessThan(0.05);
});

test('parameters override the defaults', () => {
  expect(letterformPose(1, { turn: 30, rise: 0, zoom: 0 })).toEqual({ rotate: 30, rise: 0, scale: 1 });
  expect(LETTERFORM_DEFAULTS).toEqual({ turn: -90, rise: 0.18, zoom: 0.12 });
});

test('vars are fixed-decimal strings with their units', () => {
  expect(letterformVars(letterformPose(0))).toEqual({ '--mark-rotate': '0.00deg', '--mark-rise': '0.0000', '--mark-scale': '1.0000' });
  expect(letterformVars(letterformPose(1))).toEqual({ '--mark-rotate': '-90.00deg', '--mark-rise': '0.1800', '--mark-scale': '1.1200' });
});
