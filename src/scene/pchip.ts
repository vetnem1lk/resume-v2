// Monotone cubic (PCHIP) interpolation for the camera anchor table: passes through every key,
// never overshoots, and stays monotone when the keys are. Slopes: Fritsch-Butland weighted
// harmonic mean, Moler one-sided end slopes (the scheme of scipy's PchipInterpolator).

function endSlope(h0: number, h1: number, d0: number, d1: number): number {
  const d = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (Math.sign(d) !== Math.sign(d0)) return 0;
  if (Math.sign(d0) !== Math.sign(d1) && Math.abs(d) > Math.abs(3 * d0)) return 3 * d0;
  return d;
}

/** Slope at each key; `xs` must be strictly increasing. Exported for the plateau test. */
export function pchipSlopes(xs: readonly number[], ys: readonly number[]): readonly number[] {
  const n = xs.length;
  if (n < 2) throw new Error('pchip needs at least two keys');
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const step = xs[i + 1] - xs[i];
    if (step <= 0) throw new Error('pchip keys must be strictly increasing');
    h.push(step);
    d.push((ys[i + 1] - ys[i]) / step);
  }
  if (n === 2) return [d[0], d[0]];
  const m = Array.from({ length: n }, () => 0);
  for (let i = 1; i < n - 1; i += 1) {
    if (d[i - 1] * d[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  m[0] = endSlope(h[0], h[1], d[0], d[1]);
  m[n - 1] = endSlope(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  return m;
}

/** Builds y(x), clamped to the end values outside the key range. */
export function pchip(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const m = pchipSlopes(xs, ys);
  const n = xs.length;
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    const i = Math.max(0, xs.findLastIndex((k) => k <= x));
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i]
      + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1]
      + (t3 - t2) * h * m[i + 1];
  };
}

/** Drops keys that are not finite or do not strictly advance; the table comes from live layout,
 *  where a collapsed or duplicated section must degrade the scene, never throw it away. */
export function sanitizeKeys<K extends { readonly u: number; readonly y: number }>(keys: readonly K[]): K[] {
  const out: K[] = [];
  for (const k of keys) {
    if (!Number.isFinite(k.u) || !Number.isFinite(k.y)) continue;
    if (out.length === 0 || k.u > out[out.length - 1].u) out.push(k);
  }
  return out;
}
