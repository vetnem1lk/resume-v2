// The island's renderer: the WebGL2 probe and the tier, the exact device-pixel sizing, the
// renderer + scene + camera handle with its deferred environment, context-loss recovery and
// teardown. Nothing here renders a frame; the island owns the loop.
import { NeutralToneMapping, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { addLights, buildEnvironment, LIGHTS, type Lights } from './lights.ts';

const SOFT = /swiftshader|llvmpipe|software|basic render/i;

/** The unmasked renderer string, '' where the browser hides it (Firefox sanitises it: it may only downgrade). */
export function rendererName(gl: WebGL2RenderingContext): string {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext === null ? '' : String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
}

/** A real WebGL2 context before the island commits to building anything; released at once. */
export function canRender(): boolean {
  if (!('WebGL2RenderingContext' in globalThis)) return false;
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
  if (gl === null) return false;
  const name = rendererName(gl);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return !SOFT.test(name);
}

export type Tier = 'high' | 'low';
export function tierOf(rendererString: string, cores: number): Tier { return SOFT.test(rendererString) || cores < 4 ? 'low' : 'high'; }
export function dprCap(tier: Tier): number { return tier === 'high' ? 2 : 1; }

/** Runs `teardown` once `pending` settles: never pull GL out from under an in-flight compile. */
export function afterPending(pending: Promise<unknown> | null, teardown: () => void): void {
  if (pending) void pending.then(teardown, teardown);
  else teardown();
}

const HAS_DEVICE_PIXEL_BOX = typeof ResizeObserverEntry !== 'undefined' && 'devicePixelContentBoxSize' in ResizeObserverEntry.prototype;

/** The canvas's drawing-buffer size in device pixels, capped at `cap` per CSS pixel: exact where the
 *  browser reports it (Chrome, Firefox 108+), the CSS box times the ratio elsewhere. */
export function observeCanvasSize(canvas: HTMLCanvasElement, cap: number, onSize: (width: number, height: number) => void): ResizeObserver {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const ratio = Math.min(devicePixelRatio, cap);
      const exact = entry.devicePixelContentBoxSize?.[0];
      if (exact) onSize(Math.round(exact.inlineSize * ratio / devicePixelRatio), Math.round(exact.blockSize * ratio / devicePixelRatio));
      else onSize(Math.round(entry.contentRect.width * ratio), Math.round(entry.contentRect.height * ratio));
    }
  });
  observer.observe(canvas, HAS_DEVICE_PIXEL_BOX ? { box: 'device-pixel-content-box' } : {});
  return observer;
}

export interface RendererHandle {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Re-asserts the last observed size on the renderer and the camera (after a context restore). */
  applySize(): void;
  /** Settles once the deferred environment is on the scene (or the handle was disposed first):
   *  compile the character after it, or every program recompiles when the environment lands. */
  readonly environmentReady: Promise<void>;
  /** After every non-empty size change, once the renderer and the camera aspect carry it: the view offset follows here. */
  onSize(cb: (width: number, height: number) => void): void;
  /** On webglcontextlost (default already prevented, so the browser will restore): stop the loop. */
  onLost(cb: () => void): void;
  /** After the environment is rebuilt and the size re-asserted: re-run detectSupport, resume the loop. */
  onRestored(cb: () => void): void;
  dispose(): void;
}

/** The renderer on `canvas` (a performance caveat throws here), a lit scene whose environment lands
 *  behind rAF -> setTimeout so the loading frame paints first, and the fov-32 camera. */
export function createRenderer(canvas: HTMLCanvasElement, cap: number, overrides: Partial<Lights> = {}): RendererHandle {
  const lights: Lights = { ...LIGHTS, ...overrides };
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true, stencil: false });
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.info.autoReset = false;
  renderer.setClearAlpha(0);
  const scene = new Scene();
  addLights(scene, lights);
  const camera = new PerspectiveCamera(32, 1, 0.05, 50);

  let width = 0;
  let height = 0;
  let disposed = false;
  let sized: ((width: number, height: number) => void) | null = null;
  let lost: (() => void) | null = null;
  let restored: (() => void) | null = null;

  // The observer already delivers device pixels, so the pixel ratio stays at three's 1 and setSize
  // gets the exact buffer size: setSize(css) at a fractional ratio floors css * ratio and can miss
  // the reported box by one pixel.
  const applySize = (): void => {
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  // A collapsed canvas keeps the last size: nothing is visible, and a 0/0 aspect would poison the camera.
  const observer = observeCanvasSize(canvas, cap, (w, h) => {
    if (w === 0 || h === 0) return;
    width = w;
    height = h;
    applySize();
    sized?.(w, h);
  });

  // A restore drops the old texture instead of disposing it: its GL object died with the context,
  // and deleting a pre-loss object on the restored context is an INVALID_OPERATION warning.
  const environment = (): void => {
    scene.environment = buildEnvironment(renderer, lights.environmentSize);
  };
  // The wait always ends: a rAF that never fires (a hidden document) or a throwing build must not
  // strand a consumer that chains its compile - and its teardown - on this promise.
  let settle!: () => void;
  const environmentReady = new Promise<void>((resolve) => { settle = resolve; });
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        if (!disposed && scene.environment === null) environment();
      } finally {
        settle();
      }
    }, 0);
  });

  const handleLost = (event: Event): void => {
    event.preventDefault();
    lost?.();
  };
  const handleRestored = (): void => {
    environment();
    applySize();
    restored?.();
  };
  canvas.addEventListener('webglcontextlost', handleLost);
  canvas.addEventListener('webglcontextrestored', handleRestored);

  return {
    renderer,
    scene,
    camera,
    applySize,
    environmentReady,
    onSize: (cb) => { sized = cb; },
    onLost: (cb) => { lost = cb; },
    onRestored: (cb) => { restored = cb; },
    dispose: () => {
      disposed = true;
      settle();
      renderer.setAnimationLoop(null);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
      scene.environment?.dispose();
      scene.environment = null;
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
