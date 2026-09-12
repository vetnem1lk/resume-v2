// Where the mobile band's head-and-shoulders window sits inside the captured poster column. The
// column is one fixed camera framing of a standing figure in a 100svh box, so the window is a share
// of the column - never of the opaque figure, which the viewport's own edge cuts off at the thigh.

export interface Size { readonly width: number; readonly height: number }
export interface Box extends Size { readonly left: number; readonly top: number }

/**
 * The band's shape (width / height): taller than a phone's box, which crops its sides, and narrower
 * than a tablet's, which crops its height from the top - so both keep the head.
 */
export const ASPECT = 0.643;
/** The window's height as a share of the column: the head plus the shoulders at this framing. */
export const PORTRAIT = 0.26;
/** Paper above the head, as a share of the window's height. */
export const HEADROOM = 0.1;
/** Rows below the top of the head, as a share of the column, whose opaque box is the head. */
export const HEAD = 0.09;

/**
 * The window to cut out of the `column` and resize onto the band: `PORTRAIT` of the column opening
 * a `HEADROOM` of paper above `headTop` (its first opaque row), widened to the band's `aspect`
 * (width / height) around `headCentre` - the head's own centre, not the figure's, whose hips sit
 * well off the head's axis - and clamped inside the column. The constants are framing knobs: a
 * capture from another camera is re-cut by eye against the printed window and the render.
 */
export function bandWindow(column: Size, headTop: number, headCentre: number, aspect: number): Box {
  const height = Math.round(column.height * PORTRAIT);
  const width = Math.min(column.width, Math.round(height * aspect));
  return {
    left: Math.max(0, Math.min(column.width - width, Math.round(headCentre - width / 2))),
    top: Math.max(0, Math.min(headTop - Math.round(height * HEADROOM), column.height - height)),
    width,
    height,
  };
}
