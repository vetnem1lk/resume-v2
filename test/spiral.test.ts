// The camera path is the one thing S5 cannot tune blind: every section key must land exactly,
// the orbit must never run backwards, and the two eye-height readings must both be selectable.
import { expect, test } from 'vitest';
import { SPIRAL_DEFAULTS, spiral, type Anchor } from '../src/scene/spiral.ts';

// A desktop-shaped fixture: measured keys look like this, the values are not the shipped ones.
const ANCHORS: readonly Anchor[] = [
  { u: 0.016, y: 1.7 }, { u: 0.157, y: 1.3 }, { u: 0.313, y: 1.0 }, { u: 0.49, y: 0.85 },
  { u: 0.625, y: 0.48 }, { u: 0.724, y: 0.25 }, { u: 0.837, y: 0.05 }, { u: 0.972, y: 0 },
];

test('opens on the left front quarter at the base radius and 1.5 turns later ends behind', () => {
  const s = spiral(ANCHORS);
  expect(s.angle(0)).toBeCloseTo((-25 * Math.PI) / 180, 12);
  expect(s.angle(1)).toBeCloseTo((-25 * Math.PI) / 180 + 3 * Math.PI, 12);
  expect(s.radius(0)).toBeCloseTo(2.05, 12);
  expect(s.radius(0.5)).toBeCloseTo(3.4, 12);
  expect(s.radius(1)).toBeCloseTo(2.05, 12);
  const [x, , z] = s.position(0);
  expect(x).toBeCloseTo(-0.866367, 5);
  expect(z).toBeCloseTo(-1.857931, 5);
});

test('every key lands exactly: camera height = anchor + eye offset, look at the anchor', () => {
  const s = spiral(ANCHORS);
  ANCHORS.forEach((a, i) => {
    const k = s.key(i);
    const offset = 1.15 + (0.35 - 1.15) * a.u;
    expect(k.position[1]).toBeCloseTo(a.y + offset, 12);
    expect(k.look).toEqual([0, a.y, 0]);
  });
});

test('the absolute eye rule reads the offset as the camera height above the floor', () => {
  const s = spiral(ANCHORS, { eye: 'absolute' });
  expect(s.position(0)[1]).toBeCloseTo(1.15, 12);
  expect(s.position(1)[1]).toBeCloseTo(0.35, 12);
});

test('the orbit angle and the anchor height are monotone over the whole scroll', () => {
  const s = spiral(ANCHORS);
  let angle = Number.NEGATIVE_INFINITY;
  let y = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 2000; i += 1) {
    const u = i / 2000;
    expect(s.angle(u)).toBeGreaterThanOrEqual(angle);
    expect(s.anchorY(u)).toBeLessThanOrEqual(y + 1e-12);
    angle = s.angle(u);
    y = s.anchorY(u);
  }
});

test('the look target lags the camera along the scroll and clamps at the start', () => {
  const s = spiral(ANCHORS);
  expect(s.look(0.5)).toEqual([0, s.anchorY(0.44), 0]);
  expect(s.look(0.02)).toEqual([0, s.anchorY(0), 0]);
});

test('u is clamped, so overscroll never leaves the path', () => {
  const s = spiral(ANCHORS);
  expect(s.position(-0.2)).toEqual(s.position(0));
  expect(s.position(1.3)).toEqual(s.position(1));
});

test('defaults are the spec values and a broken override is refused', () => {
  expect(SPIRAL_DEFAULTS).toMatchObject({ turns: 1.5, rBase: 2.05, rBulge: 1.35, eyeTop: 1.15, eyeBottom: 0.35, lookLag: 0.06, eye: 'aboveAnchor' });
  expect(() => spiral(ANCHORS, { turns: undefined })).toThrow(/turns/);
  expect(() => spiral(ANCHORS, { rBase: Number.NaN })).toThrow(/rBase/);
  expect(() => spiral([{ u: 0, y: 1 }])).toThrow(/two keys/);
});
