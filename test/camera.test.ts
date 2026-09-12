// The view offset that puts the character's axis in the poster column, and the strip-x parser.
import { expect, test } from 'vitest';
import { parseStripX, viewOffsetX } from '../src/island/camera.ts';

test('the offset moves the frustum so the origin projects at the column', () => {
  expect(viewOffsetX(0.5, 1440)).toBe(0);
  expect(viewOffsetX(0.46, 1440)).toBeCloseTo(57.6, 9);
  expect(viewOffsetX(0.4, 1024)).toBeCloseTo(102.4, 9);
});

test('--strip-x parses as a fraction and defaults to the centre', () => {
  expect(parseStripX('46%')).toBe(0.46);
  expect(parseStripX(' 40% ')).toBe(0.4);
  expect(parseStripX('')).toBe(0.5);
  expect(parseStripX('junk')).toBe(0.5);
});
