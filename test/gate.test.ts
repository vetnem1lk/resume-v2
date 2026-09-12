// The island gate: every signal alone keeps the scene off the page; reduced motion is not one.
import { expect, test } from 'vitest';
import { gateReason, WIDE } from '../src/scene/gate.ts';

const ok = { wide: true, webgl2: true, saveData: false };

test('a wide WebGL2 page without a data-saver preference gets the island', () => {
  expect(gateReason(ok)).toBeNull();
});

test('a narrow viewport, no WebGL2 or a data-saver preference each keep the poster, in that order', () => {
  expect(gateReason({ ...ok, wide: false })).toBe('narrow');
  expect(gateReason({ ...ok, webgl2: false })).toBe('no-webgl2');
  expect(gateReason({ ...ok, saveData: true })).toBe('save-data');
  expect(gateReason({ wide: false, webgl2: false, saveData: true })).toBe('narrow');
});

test('the breakpoint is the stylesheet breakpoint', () => {
  expect(WIDE).toBe('(min-width: 1024px)');
});
