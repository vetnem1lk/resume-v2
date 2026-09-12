// Reads the document scroll once per animation frame and hands out one number. Platform APIs
// only: no three.js, nothing that runs while the document is hidden. Order inside a frame is
// load-bearing: read scrollY first (it forces layout if anything is dirty), then compute.
import { damp, initialSettle, scrollProgress, settleStep, type SettleState } from './progress.ts';

export interface ScrollFrame {
  readonly u: number;
  readonly uSmooth: number;
  readonly dt: number;
  readonly now: number;
  readonly settled: boolean;
}

export interface ScrollDriverOptions {
  onFrame(frame: ScrollFrame): void;
  /** Transitions only, never an opening call: seed from the first frame's ScrollFrame.settled. */
  onSettle(settled: boolean, u: number): void;
  /** Damping rate; Infinity under reduced motion makes uSmooth follow u exactly (D8). */
  readonly lambda?: number;
  readonly holdMs?: number;
  readonly maxDt?: number;
}

export interface ScrollDriver {
  /** One step; start() runs it from its own rAF loop, a scene loop may call it directly. */
  frame(now: number): void;
  start(): void;
  stop(): void;
  /** Marks the layout stale: maxScroll is re-read at the top of the next frame. */
  invalidate(): void;
}

export function createScrollDriver(options: ScrollDriverOptions): ScrollDriver {
  const lambda = options.lambda ?? 5;
  const holdMs = options.holdMs ?? 400;
  const maxDt = options.maxDt ?? 0.05;

  let running = false;
  let handle = 0;
  let stale = true;
  let maxScroll = 0;
  let epsilon = 1e-4;
  let last = 0;
  let uSmooth = 0;
  let settle: SettleState = initialSettle(0, 0);
  // What onSettle last heard. Kept apart from settle.phase because resync() reseeds the state out
  // of band, and a transition the consumer never heard would strand it in the phase it last saw.
  let reported = true;

  // CSSOM: root scrollHeight is max(scrolling area, viewport), so the range is never negative.
  // Never innerHeight: it includes the horizontal scrollbar and tracks the visual viewport.
  const measure = (): void => {
    const root = document.documentElement;
    maxScroll = root.scrollHeight - root.clientHeight;
    epsilon = maxScroll > 0 ? 0.25 / maxScroll : 1e-4; // a quarter of a CSS pixel at any runway
    stale = false;
  };
  const invalidate = (): void => { stale = true; };
  const observer = new ResizeObserver(invalidate);

  const frame = (now: number): void => {
    const y = window.scrollY;
    if (stale) measure();
    const dt = Math.min(Math.max(now - last, 0) / 1000, maxDt);
    last = now;
    const u = scrollProgress(y, maxScroll);
    uSmooth = damp(uSmooth, u, lambda, dt);
    settle = settleStep(settle, u, uSmooth, now, holdMs, epsilon);
    const settled = settle.phase === 'settled';
    if (settled !== reported) {
      reported = settled;
      options.onSettle(settled, u);
    }
    options.onFrame({ u, uSmooth, dt, now, settled });
  };

  const tick = (now: number): void => {
    handle = 0; // HTML removes the callback before invoking it: the old handle is already dead
    frame(now);
    if (running) handle = requestAnimationFrame(tick);
  };

  // rAF does not run while hidden, so the first frame back would see the whole away time.
  const resync = (): void => {
    measure();
    last = performance.now();
    uSmooth = scrollProgress(window.scrollY, maxScroll);
    settle = initialSettle(uSmooth, last);
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') resync();
  };
  // An anchor click moves u by up to 0.63 in one frame; hashchange fires before the scroll event
  // and already sees the new position, so the camera cuts instead of swooping.
  const onHashChange = (): void => {
    if (stale) measure();
    uSmooth = scrollProgress(window.scrollY, maxScroll);
  };

  return {
    frame,
    invalidate,
    start() {
      if (running) return;
      running = true;
      resync();
      observer.observe(document.documentElement);
      window.addEventListener('resize', invalidate, { passive: true });
      window.visualViewport?.addEventListener('resize', invalidate, { passive: true });
      window.addEventListener('hashchange', onHashChange);
      document.addEventListener('visibilitychange', onVisibility);
      handle = requestAnimationFrame(tick);
    },
    stop() {
      if (!running) return;
      running = false;
      if (handle !== 0) { cancelAnimationFrame(handle); handle = 0; }
      observer.disconnect();
      window.removeEventListener('resize', invalidate);
      window.visualViewport?.removeEventListener('resize', invalidate);
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
