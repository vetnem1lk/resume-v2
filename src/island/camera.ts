// The spiral camera: the view-offset arithmetic and the strip-x parser (pure, Node-importable), the
// stage read, and the two three-typed appliers the island calls per size change and per frame.
import type { PerspectiveCamera } from 'three';
import type { Spiral } from '../scene/spiral.ts';

/** `--strip-x` as a fraction of the stage width: a percentage token, or the centre for anything else. */
export function parseStripX(value: string): number {
  const pct = Number.parseFloat(value.trim());
  return Number.isFinite(pct) && value.includes('%') ? pct / 100 : 0.5;
}

/** The view-offset x that projects the world origin at `stripX` of a `width`-wide image. */
export function viewOffsetX(stripX: number, width: number): number { return (0.5 - stripX) * width; }

/** The stage's `--strip-x` (doc.css), read at the measure moments, never per frame. */
export function readStripX(stage: Element): number {
  return parseStripX(getComputedStyle(stage).getPropertyValue('--strip-x'));
}

/** Shifts the frustum so the character's axis projects at the poster column. Unit-agnostic: the
 *  island hands it the canvas's device pixels. */
export function applyViewOffset(camera: PerspectiveCamera, stripX: number, width: number, height: number): void {
  camera.setViewOffset(width, height, viewOffsetX(stripX, width), 0, width, height);
}

/** The camera on the spiral at scroll progress `u`: position and look target, nothing else moves. */
export function applySpiral(camera: PerspectiveCamera, rig: Spiral, u: number): void {
  const [px, py, pz] = rig.position(u);
  const [lx, ly, lz] = rig.look(u);
  camera.position.set(px, py, pz);
  camera.lookAt(lx, ly, lz);
}
