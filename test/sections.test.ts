// Section keys are measured, never derived: the sticky strip, overflowing blocks and the mobile
// layout all move them. Pin the arithmetic of both key rules on a hand-written layout.
import { expect, test } from 'vitest';
import { SECTION_IDS } from '../src/content/types.ts';
import { ANCHOR_Y, sectionKeys, type SectionBox } from '../src/scene/sections.ts';

// Desktop-shaped: eight blocks after a 56 px strip, viewport 900, range 6356, scroll margin 88.
const BOXES: readonly SectionBox[] = SECTION_IDS.map((id, i) => ({
  id, top: 56 + i * 900, height: 900, scrollMargin: 88,
}));
const LAYOUT = { range: 6356, viewport: 900 };

test('the table covers every section, decreasing from head to floor', () => {
  expect(Object.keys(ANCHOR_Y)).toEqual([...SECTION_IDS]);
  expect(ANCHOR_Y.top).toBe(1.7);
  expect(ANCHOR_Y.contact).toBe(0);
  const ys = SECTION_IDS.map((id) => ANCHOR_Y[id]);
  expect(ys).toEqual([...ys].toSorted((a, b) => b - a));
});

test('landing keys are where an anchor click lands, in section order', () => {
  const keys = sectionKeys(BOXES, LAYOUT);
  expect(keys.map((k) => k.id)).toEqual([...SECTION_IDS]);
  expect(keys[1].u).toBeCloseTo((56 + 900 - 88) / 6356, 12);
  expect(keys[0].u).toBeLessThan(0);   // the header starts under the strip: before the first scroll
  expect(keys.at(-1)!.u).toBeCloseTo((56 + 7 * 900 - 88) / 6356, 12);
  keys.forEach((k) => expect(k.y).toBe(ANCHOR_Y[k.id]));
});

test('centre keys are where the section centre crosses the viewport centre', () => {
  const keys = sectionKeys(BOXES, LAYOUT, 'centre');
  expect(keys[1].u).toBeCloseTo((56 + 900 + 450 - 450) / 6356, 12);
  // Viewport != height, so neither half of the rule cancels: a dropped or swapped half fails here.
  expect(sectionKeys(BOXES, { range: 6356, viewport: 300 }, 'centre')[1].u).toBeCloseTo((956 + 450 - 150) / 6356, 12);
});

test('keys stay strictly increasing and an empty range yields no keys', () => {
  const collapsed = BOXES.map((b, i) => (i === 2 ? { ...b, top: BOXES[1].top } : b));
  expect(sectionKeys(collapsed, LAYOUT).map((k) => k.id)).not.toContain('projects');
  expect(sectionKeys(BOXES, { range: 0, viewport: 900 })).toEqual([]);
});
