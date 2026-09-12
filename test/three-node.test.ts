// three under Node, here and in loaders.test.ts (both renderer-free): the pinned version pair,
// and the S3 damp against three's own (they part only at the zero-length reduced-motion frame,
// where three returns NaN).
import { readFileSync } from 'node:fs';
import { MathUtils, REVISION } from 'three';
import { expect, test } from 'vitest';
import { damp } from '../src/scroll/progress.ts';

const version = (pkg: string): string =>
  (JSON.parse(readFileSync(new URL(`../node_modules/${pkg}/package.json`, import.meta.url), 'utf8')) as { version: string }).version;

test('three and its types are the same exact version, and it is the one the plan verified', () => {
  expect(version('three')).toBe('0.186.0');
  expect(version('@types/three')).toBe(version('three'));
  expect(REVISION).toBe('186');
});

test('progress.damp is MathUtils.damp to the last bit, except that it survives a zero-length frame', () => {
  for (const dt of [1 / 120, 1 / 60, 0.05]) expect(damp(0.2, 0.8, 5, dt)).toBe(MathUtils.damp(0.2, 0.8, 5, dt));
  expect(Number.isNaN(MathUtils.damp(0, 1, Number.POSITIVE_INFINITY, 0))).toBe(true);
  expect(damp(0, 1, Number.POSITIVE_INFINITY, 0)).toBe(0);
});
