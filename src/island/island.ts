// The scene island, the only chunk that imports three: mounts the renderer on the stage, streams the
// character in, mirrors it on the floor, and runs the one animation loop that steps the scroll rig,
// the idle, the beats and the render. Everything here is undone by unmount().
import { Timer, type Mesh, type Object3D, type Texture } from 'three';
import { bus } from '../beat/bus.ts';
import { wireClicks } from '../beat/clicks.ts';
import { initialScrollBeatState, scrollBeats, type ScrollBeatState } from '../beat/scroll.ts';
import { POSTER } from '../scene/assets.ts';
import { WIDE } from '../scene/gate.ts';
import { LETTERFORM_DEFAULTS, letterformPose, letterformVars, type LetterformParams } from '../scene/letterform.ts';
import { INITIAL_LOAD, loadStep, type LoadState } from '../scene/loadstate.ts';
import { measureSections, sectionKeys, usableKeys, type SectionKey } from '../scene/sections.ts';
import { SPIRAL_DEFAULTS, spiral, type Spiral, type SpiralParams } from '../scene/spiral.ts';
import { createScrollDriver, type ScrollDriver, type ScrollFrame, type ScrollLayout } from '../scroll/driver.ts';
import { REDUCED_MOTION, watchMedia } from '../scroll/media.ts';
import { applySpiral, applyViewOffset, readStripX } from './camera.ts';
import { adoptCharacter, type Character } from './character.ts';
import { mirrorFloor, type Floor } from './floor.ts';
import type { Lights } from './lights.ts';
import { detectSupport, loadCharacter } from './loaders.ts';
import { capturePoster, LIVE, live, posterCrop } from './poster.ts';
import { afterPending, canRender, createRenderer, dprCap, tierOf, type RendererHandle } from './renderer.ts';

export interface IslandOptions {
  readonly camera?: 'spiral' | 'fixed';
  readonly spiral?: Partial<SpiralParams>;
  readonly letterform?: Partial<LetterformParams>;
  readonly lights?: Partial<Lights>;
}

/** The character's soles rest on y = 0 (the assemble step bakes the contact offset). */
const FLOOR_Y = 0;
/** The longest step the idle may take in one frame, seconds: a hidden tab never lands as a jump. */
const MAX_DT = 0.05;
const MARK_VARS = ['--mark-rotate', '--mark-rise', '--mark-scale'] as const;
/** Frames the DEV rAF-gap median is taken over. */
const GAP_FRAMES = 120;

let active: (() => void) | null = null;
let lastOptions: IslandOptions = {};
let wideWatch: (() => void) | null = null;

/** Undoes the mounted island; the poster stays. Safe to call twice. */
export function unmount(): void {
  const teardown = active;
  if (teardown === null) return;
  active = null;
  teardown();
}

/** Mounts once; a second call is a no-op. The breakpoint watcher installed on the first successful
 *  mount outlives it: narrowing unmounts, widening mounts again with the same options. */
export function mount(options: IslandOptions = {}): void {
  if (active !== null) return;
  lastOptions = options;
  const stage = document.querySelector<HTMLElement>('.stage');
  if (stage === null || !canRender()) return;
  active = start(stage, options);
  if (active !== null) wideWatch ??= watchMedia(WIDE, (wide) => { if (wide) mount(lastOptions); else unmount(); });
}

/** Geometries, every texture a material carries, then the materials; each dispose is idempotent. */
function disposeTree(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
      material.dispose();
    }
  });
}

/** The whole mounted island; returns its teardown, or null when the renderer refused the context. */
function start(stage: HTMLElement, options: IslandOptions): (() => void) | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'stage__canvas';
  stage.append(canvas);
  // canRender() has already refused a software renderer, so the core count alone decides the tier.
  const tier = tierOf('', navigator.hardwareConcurrency ?? 4);
  let handle: RendererHandle;
  try {
    handle = createRenderer(canvas, dprCap(tier), options.lights);
  } catch {
    canvas.remove();
    return null;
  }
  const { renderer, scene, camera } = handle;
  detectSupport(renderer);

  const mark = document.querySelector<SVGElement>('.stage__letterform');
  const letterform: LetterformParams = { ...LETTERFORM_DEFAULTS, ...options.letterform };
  const fixed = options.camera === 'fixed';
  const controller = new AbortController();
  const timer = new Timer();
  timer.connect(document);

  let state: LoadState = loadStep(INITIAL_LOAD, { type: 'start' });
  let character: Character | null = null;
  let floor: Floor | null = null;
  let compiling: Promise<unknown> | null = null;
  let driver: ScrollDriver | null = null;
  let rig: Spiral | null = null;
  let rigWarned = false;
  let keys: readonly SectionKey[] = [];
  let beatState: ScrollBeatState | null = null;
  let reduced = false;
  let dead = false;
  // Under reduced motion a frame is rendered only when something it shows has changed.
  let dirty = true;
  let stripX = readStripX(stage);
  let width = 0;
  let height = 0;
  let now = 0;
  let lastU = -1;
  let lastFrame: ScrollFrame | null = null;
  const gaps = new Float64Array(GAP_FRAMES);
  let frames = 0;
  let previous = 0;

  const clearMark = (): void => {
    if (mark !== null) for (const name of MARK_VARS) mark.style.removeProperty(name);
  };
  /** The one-shot guard: the first throw (or a failed load) disables the 3D and leaves the poster. */
  const disable3D = (error: unknown): void => {
    if (dead) return;
    console.error(error);
    unmount();
  };

  handle.onSize((w, h) => {
    width = w;
    height = h;
    applyViewOffset(camera, stripX, w, h);
    dirty = true;
  });
  handle.onLost(() => { renderer.setAnimationLoop(null); });
  handle.onRestored(() => {
    detectSupport(renderer);
    dirty = true;
    renderer.setAnimationLoop(loop);
  });

  const onMeasure = (layout: ScrollLayout): void => {
    keys = usableKeys(sectionKeys(measureSections().boxes, layout, 'landing'));
    try {
      rig = spiral(keys, options.spiral);
    } catch (error) {
      // The previous rig stands; the reason reaches the console once.
      if (!rigWarned) { rigWarned = true; console.error(error); }
    }
    beatState = null;
    lastU = -1;
    stripX = readStripX(stage);
    if (width > 0) applyViewOffset(camera, stripX, width, height);
  };
  const onFrame = (frame: ScrollFrame): void => {
    lastFrame = frame;
    if (frame.uSmooth !== lastU) {
      lastU = frame.uSmooth;
      if (rig !== null) {
        applySpiral(camera, rig, fixed ? 0 : lastU);
        dirty = true;
      }
      if (!reduced && mark !== null) {
        const vars = letterformVars(letterformPose(lastU, letterform));
        for (const name of MARK_VARS) mark.style.setProperty(name, vars[name]);
      }
    }
    beatState ??= initialScrollBeatState(frame.u);
    // A still frame yields nothing (measured on the pure function), so it is not asked.
    if (frame.u === beatState.u && !beatState.flinging) return;
    const step = scrollBeats(beatState, frame.u, frame.dt, keys, frame.now);
    beatState = step.state;
    for (const beat of step.beats) bus.emit(beat);
  };
  const onSettle = (settled: boolean, u: number): void => {
    bus.emit({ name: settled ? 'scroll:settle' : 'scroll:start', source: 'scroll', at: now, data: { u } });
  };
  const restartDriver = (): void => {
    driver?.stop();
    driver = createScrollDriver({ loop: false, lambda: reduced ? Infinity : undefined, onFrame, onSettle, onMeasure });
    driver.start();
  };
  // Infinity makes uSmooth follow u exactly; the idle freezes on a settled pose; the mark stands still.
  const offReduced = watchMedia(REDUCED_MOTION, (matches) => {
    reduced = matches;
    if (matches) clearMark();
    character?.freeze(matches);
    dirty = true;
    restartDriver();
  });
  wireClicks(bus, document, controller.signal);

  void loadCharacter((pct) => { state = loadStep(state, { type: 'bytes', received: pct, total: 100 }); })
    .then((gltf) => {
      if (dead) return;
      state = loadStep(loadStep(state, { type: 'fetched' }), { type: 'parsed' });
      character = adoptCharacter(gltf);
      floor = mirrorFloor(character.root, FLOOR_Y);
      if (reduced) character.freeze(true);
      // In the scene but hidden until the programs are linked: a visible object would make the next
      // frame compile every program synchronously, which is the stall compileAsync exists to avoid.
      const staged = [character.root, ...floor.twins, floor.shadow];
      for (const object of staged) object.visible = false;
      scene.add(...staged);
      compiling = handle.environmentReady.then(() => (dead ? undefined : renderer.compileAsync(scene, camera)));
      return compiling.then(() => {
        if (dead) return;
        for (const object of staged) object.visible = true;
        state = loadStep(state, { type: 'compiled' });
        dirty = true;
      });
    })
    .catch(disable3D);

  const loop = (time: number): void => {
    if (dead) return;
    try {
      now = time;
      driver?.frame(time);
      timer.update(time);
      const dt = Math.min(timer.getDelta(), MAX_DT);
      if (character !== null && !reduced && Number.isFinite(dt)) {
        character.mixer.update(dt);
        character.blink(dt);
      }
      if (state.phase === 'warming') dirty = true;
      if (!reduced || dirty) {
        renderer.info.reset();
        renderer.render(scene, camera);
        dirty = false;
      }
      if (state.phase === 'warming') {
        state = loadStep(state, { type: 'frame' });
        if (state.phase === 'live') live(stage);
      }
      if (previous !== 0) {
        gaps[frames % GAP_FRAMES] = time - previous;
        frames += 1;
      }
      previous = time;
    } catch (error) {
      disable3D(error);
    }
  };
  renderer.setAnimationLoop(loop);

  if (import.meta.env.DEV) {
    const gap = (): number => {
      const n = Math.min(frames, GAP_FRAMES);
      const sorted = gaps.subarray(0, n).toSorted();
      return n === 0 ? 0 : sorted[n >> 1];
    };
    Object.assign(window, {
      __g2: {
        info: () => ({
          calls: renderer.info.render.calls,
          tris: renderer.info.render.triangles,
          fps: Math.round(1000 / gap()),
          phase: state.phase,
          size: [width, height],
          memory: { ...renderer.info.memory },
          programs: renderer.info.programs?.length ?? 0,
          u: lastFrame?.u ?? 0,
          uSmooth: lastFrame?.uSmooth ?? 0,
          idle: character?.idle.time ?? 0,
          reduced,
        }),
        gap,
        rig: () => keys,
        // The column of the frame on screen, as pipeline:poster wants it: the canvas's CSS box is the
        // viewport of the crop, and the backing store over that box is the pixel ratio.
        poster: () => capturePoster(renderer, scene, camera, posterCrop({ width: canvas.clientWidth, height: canvas.clientHeight, ratio: width / canvas.clientWidth }, stripX, POSTER.width, POSTER.height)),
        params: { camera: fixed ? 'fixed' : 'spiral', spiral: { ...SPIRAL_DEFAULTS, ...options.spiral }, letterform },
      },
    });
  }

  return () => {
    dead = true;
    renderer.setAnimationLoop(null);
    driver?.stop();
    controller.abort();
    offReduced();
    timer.dispose();
    stage.classList.remove(LIVE);
    clearMark();
    if (character !== null) disposeTree(character.root);
    floor?.dispose();
    if (import.meta.env.DEV) Reflect.deleteProperty(window, '__g2');
    afterPending(compiling, () => {
      handle.dispose();
      canvas.remove();
    });
  };
}
