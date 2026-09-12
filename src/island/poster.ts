// The poster's two duties: the stage class under which doc.css cross-fades it out beneath the live
// canvas, and the DEV capture of the column the first frame paints, which pipeline:poster encodes.
import type { Camera, Scene, WebGLRenderer } from 'three';

export interface Viewport { readonly width: number; readonly height: number; readonly ratio: number }
export interface Crop { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/** The poster column in device pixels: min(38vw, width) wide, `height` tall, centred on strip-x. */
export function posterCrop(view: Viewport, stripX: number, width: number, height: number): Crop {
  const w = Math.min(0.38 * view.width, width);
  return { x: (stripX * view.width - w / 2) * view.ratio, y: (view.height / 2 - height / 2) * view.ratio, w: w * view.ratio, h: height * view.ratio };
}

/** Under this class the canvas is shown and the poster faded; the poster stays in the DOM. */
export const LIVE = 'stage--live';

export function live(stage: Element): void { stage.classList.add(LIVE); }

/** Renders once and copies the column out of the drawing buffer in the same task (the renderer keeps
 *  no preserveDrawingBuffer); where the column overflows the canvas the copy stays transparent. */
export function capturePoster(renderer: WebGLRenderer, scene: Scene, camera: Camera, crop: Crop): string {
  renderer.render(scene, camera);
  const source = renderer.domElement;
  const out = document.createElement('canvas');
  out.width = Math.round(crop.w);
  out.height = Math.round(crop.h);
  const context = out.getContext('2d');
  if (context === null) throw new Error('poster: no 2D context');
  const sx = Math.max(crop.x, 0);
  const sy = Math.max(crop.y, 0);
  const sw = Math.min(crop.x + crop.w, source.width) - sx;
  const sh = Math.min(crop.y + crop.h, source.height) - sy;
  if (sw > 0 && sh > 0) context.drawImage(source, sx, sy, sw, sh, sx - crop.x, sy - crop.y, sw, sh);
  return out.toDataURL('image/png');
}
