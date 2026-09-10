// The three decisions the driver makes without a DOM: how far the reader is, whether the camera
// has settled, and how the camera approaches its target frame-rate independently.
import { expect, test } from 'vitest';
import { damp, initialSettle, scrollProgress, settleStep } from '../src/scroll/progress.ts';

test('progress is clamped to [0,1] and NaN-proof', () => {
  expect(scrollProgress(0, 6356)).toBe(0);
  expect(scrollProgress(3178, 6356)).toBeCloseTo(0.5, 12);
  expect(scrollProgress(6356, 6356)).toBe(1);
  expect(scrollProgress(-200, 6356)).toBe(0);
  expect(scrollProgress(7000, 6356)).toBe(1);
  expect(scrollProgress(100, 0)).toBe(0);
  expect(scrollProgress(100, -1)).toBe(0);
  expect(scrollProgress(Number.NaN, 6356)).toBe(0);
  expect(scrollProgress(100, Number.NaN)).toBe(0);
});

test('progress is monotone in the scroll offset', () => {
  let prev = 0;
  for (let y = -200; y <= 6600; y += 7) {
    const u = scrollProgress(y, 6356);
    expect(u).toBeGreaterThanOrEqual(prev);
    prev = u;
  }
});

test('a still frame returns the previous state by identity', () => {
  const s0 = initialSettle(0.3, 1000);
  expect(settleStep(s0, 0.3, 0.3, 1016)).toBe(s0);
});

test('settles only once the scroll is still AND the camera has caught up, after holdMs', () => {
  let s = initialSettle(0, 0);
  s = settleStep(s, 0.5, 0.1, 16);
  expect(s.phase).toBe('moving');
  s = settleStep(s, 0.5, 0.3, 416);       // still, but the camera is far: stays moving
  expect(s.phase).toBe('moving');
  expect(s.movedAt).toBe(416);
  s = settleStep(s, 0.5, 0.5, 700);       // caught up, 284 ms since the last move
  expect(s.phase).toBe('moving');
  s = settleStep(s, 0.5, 0.5, 816);       // 400 ms since movedAt
  expect(s.phase).toBe('settled');
  expect(s.u).toBe(0.5);
});

test('a move after settling starts a new hold', () => {
  const settled = settleStep(settleStep(initialSettle(0, 0), 0.2, 0.2, 10), 0.2, 0.2, 410);
  expect(settled.phase).toBe('settled');
  const moved = settleStep(settled, 0.21, 0.2, 420);
  expect(moved.phase).toBe('moving');
  expect(moved.movedAt).toBe(420);
});

test('epsilon decides what counts as a move', () => {
  const s = initialSettle(0.5, 0);
  expect(settleStep(s, 0.50005, 0.5, 16, 400, 1e-4)).toBe(s);
  expect(settleStep(s, 0.50005, 0.5, 16, 400, 1e-5).phase).toBe('moving');
});

test('damp is frame-rate independent and lands on the target', () => {
  let a = 0;
  for (let i = 0; i < 10; i += 1) a = damp(a, 1, 5, 0.01);
  expect(a).toBeCloseTo(damp(0, 1, 5, 0.1), 12);
  expect(damp(0, 1, 5, 0.2)).toBeCloseTo(1 - Math.exp(-1), 12);
  expect(damp(0, 1, Number.POSITIVE_INFINITY, 0.016)).toBe(1);
});
