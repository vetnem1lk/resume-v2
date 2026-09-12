// Scroll progress and camera settle as pure functions of numbers and timestamps, so the camera
// plumbing is unit-testable with no DOM and no three.js.

export function scrollProgress(scrollY: number, maxScroll: number): number {
  if (!(maxScroll > 0)) return 0;
  const u = scrollY / maxScroll;
  if (!(u > 0)) return 0;
  return u > 1 ? 1 : u;
}

export type MotionPhase = 'moving' | 'settled';

export interface SettleState {
  readonly phase: MotionPhase;
  readonly u: number;
  readonly movedAt: number;
}

export function initialSettle(u: number, now: number): SettleState {
  return { phase: 'settled', u, movedAt: now };
}

// Settled means the camera has caught up, not merely that the scroll stopped: after an anchor
// jump the scroll is idle while uSmooth is still far from the target (design SSoT D11).
// Returns the previous state by identity when nothing changed, so a still frame allocates nothing.
export function settleStep(
  prev: SettleState,
  u: number,
  uSmooth: number,
  now: number,
  holdMs = 400,
  epsilon = 1e-4,
): SettleState {
  if (Math.abs(u - prev.u) > epsilon || Math.abs(u - uSmooth) > epsilon) {
    return { phase: 'moving', u, movedAt: now };
  }
  if (prev.phase === 'moving' && now - prev.movedAt >= holdMs) {
    return { phase: 'settled', u: prev.u, movedAt: prev.movedAt };
  }
  return prev;
}

/** Frame-rate independent exponential approach; the same function as three r185 MathUtils.damp. */
export function damp(x: number, y: number, lambda: number, dt: number): number {
  // No elapsed time, no movement. Also keeps a lambda of Infinity out of Infinity * 0, which is
  // NaN: one such frame would poison the damped value for the life of the page.
  if (!(dt > 0)) return x;
  return x + (y - x) * (1 - Math.exp(-lambda * dt));
}
