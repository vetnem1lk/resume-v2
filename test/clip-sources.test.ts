// The clip registry: unique ids, the shipped idle is the engine example with its measured facts,
// and nothing unregistered or non-shipping can be baked.
import { expect, test } from 'vitest';
import { CLIP_SOURCES, clipSource, shippingClips } from '../scripts/pipeline/clip-sources.ts';

test('ids are unique and every entry names an origin, a route and a project asset path', () => {
  expect(new Set(CLIP_SOURCES.map((c) => c.id)).size).toBe(CLIP_SOURCES.length);
  for (const c of CLIP_SOURCES) {
    expect(c.origin.length).toBeGreaterThan(0);
    expect(c.route.length).toBeGreaterThan(0);
    expect(c.assetPath.startsWith('/Game/')).toBe(true);
  }
});

test('the shipped idle is the engine example, measured, seam kept, and the only shipping clip today', () => {
  expect(clipSource('Idle')).toMatchObject({
    asset: 'MM_Idle', licence: 'engine-examples', ships: true, seam: 'loop-seam-kept',
    measured: { frames: 227, keys: 228, fps: 30, rootMotion: false },
  });
  expect(CLIP_SOURCES.filter((c) => c.ships).map((c) => c.id)).toEqual(['Idle']);
  expect(CLIP_SOURCES.filter((c) => c.measured !== undefined).every((c) => c.measured?.keys === (c.measured?.frames ?? 0) + 1)).toBe(true);
});

test('unregistered and non-shipping clips are refused by name', () => {
  expect(shippingClips(['Idle']).map((c) => c.asset)).toEqual(['MM_Idle']);
  expect(() => shippingClips(['Walk_Fwd'])).toThrow(/does not ship/);
  expect(() => clipSource('Dance')).toThrow(/not registered/);
});
