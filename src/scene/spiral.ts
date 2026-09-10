// Camera path for the scroll scene (design SSoT section 2): scroll progress u in [0,1] maps to a
// camera position and a look target on a closed-form spiral around the character at the origin.
// No spline and no arc-length reparametrisation: the closed form IS the path, it hits every
// measured section key exactly (D4), and it needs no three.js. Frame: +Y up, right-handed, the
// character faces -Z; angle 0 is in front of the face, positive is clockwise seen from above.
import { pchip } from './pchip.ts';

export type Vec3 = readonly [number, number, number];

export interface Anchor {
  readonly u: number;
  readonly y: number;
}

/** 'aboveAnchor': the eye offset is added to the anchor height (the spec sentence read literally);
 *  'absolute': the offset is the camera height above the floor. Founder call on the debug canvas. */
export type EyeRule = 'aboveAnchor' | 'absolute';

export interface SpiralParams {
  /** Full orbit turns over the whole document. */
  readonly turns: number;
  /** Orbit angle at u = 0, radians. */
  readonly theta0: number;
  /** Orbit radius at both ends, metres. */
  readonly rBase: number;
  /** Extra radius at u = 0.5, metres. */
  readonly rBulge: number;
  /** Eye offset at u = 0 and u = 1, metres; see EyeRule. */
  readonly eyeTop: number;
  readonly eyeBottom: number;
  readonly eye: EyeRule;
  /** Look-target lag along the scroll, in u. */
  readonly lookLag: number;
}

export const SPIRAL_DEFAULTS: SpiralParams = {
  turns: 1.5,
  theta0: (-25 * Math.PI) / 180,
  rBase: 2.05,
  rBulge: 1.35,
  eyeTop: 1.15,
  eyeBottom: 0.35,
  eye: 'aboveAnchor',
  lookLag: 0.06,
};

export interface Spiral {
  readonly params: SpiralParams;
  readonly anchors: readonly Anchor[];
  radius(u: number): number;
  angle(u: number): number;
  anchorY(u: number): number;
  position(u: number): Vec3;
  look(u: number): Vec3;
  /** The pose section i is meant to frame: its key, with no lag. */
  key(i: number): { position: Vec3; look: Vec3 };
}

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

export function spiral(anchors: readonly Anchor[], overrides: Partial<SpiralParams> = {}): Spiral {
  const p: SpiralParams = { ...SPIRAL_DEFAULTS, ...overrides };
  for (const [name, value] of Object.entries(p)) {
    if (name !== 'eye' && !Number.isFinite(value)) throw new Error(`spiral: ${name} must be a finite number`);
  }
  const anchorY = pchip(anchors.map((a) => a.u), anchors.map((a) => a.y));
  const sweep = 2 * Math.PI * p.turns;
  const eyeOffset = (u: number): number => p.eyeTop + (p.eyeBottom - p.eyeTop) * u;
  const cameraY = (u: number): number =>
    p.eye === 'absolute' ? eyeOffset(u) : anchorY(u) + eyeOffset(u);
  const radius = (u: number): number => p.rBase + p.rBulge * Math.sin(Math.PI * clamp01(u));
  const angle = (u: number): number => p.theta0 + sweep * clamp01(u);
  const position = (u: number): Vec3 => {
    const c = clamp01(u);
    const r = radius(c);
    const a = angle(c);
    return [r * Math.sin(a), cameraY(c), -r * Math.cos(a)];
  };
  const look = (u: number): Vec3 => [0, anchorY(clamp01(u - p.lookLag)), 0];
  return {
    params: p,
    anchors,
    radius,
    angle,
    anchorY,
    position,
    look,
    key: (i) => ({ position: position(anchors[i].u), look: [0, anchors[i].y, 0] }),
  };
}
