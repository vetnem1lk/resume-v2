// Parallax pose of the hatched letterform: the flat stage mark turns, rises and zooms with the
// camera's scroll progress, so it reads as part of the moving scene instead of a watermark. Pure -
// the island writes the pose as three CSS custom properties; without them doc.css leaves it as is.

export interface LetterformPose {
  /** Degrees, negative = counter-clockwise. */
  readonly rotate: number;
  /** Fraction of the viewport height the mark has risen. */
  readonly rise: number;
  readonly scale: number;
}

export interface LetterformParams {
  /** Total rotation over the whole scroll, degrees. */
  readonly turn: number;
  /** Total rise over the whole scroll, fraction of the viewport height. */
  readonly rise: number;
  /** Extra scale at the bottom, 0.12 = 12 percent larger. */
  readonly zoom: number;
}

export const LETTERFORM_DEFAULTS: LetterformParams = { turn: -90, rise: 0.18, zoom: 0.12 };

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Starts and ends at rest, so the mark never jumps at either end of the document. */
export function smoothstep(u: number): number {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
}

export function letterformPose(u: number, params: LetterformParams = LETTERFORM_DEFAULTS): LetterformPose {
  const k = smoothstep(u);
  return { rotate: params.turn * k, rise: params.rise * k, scale: 1 + params.zoom * k };
}

/** The three custom properties doc.css reads. Fixed decimals: equal poses give equal strings,
 *  so a still frame writes nothing new to the style engine. */
export function letterformVars(pose: LetterformPose): Record<'--mark-rotate' | '--mark-rise' | '--mark-scale', string> {
  return {
    '--mark-rotate': `${pose.rotate.toFixed(2)}deg`,
    '--mark-rise': pose.rise.toFixed(4),
    '--mark-scale': pose.scale.toFixed(4),
  };
}
