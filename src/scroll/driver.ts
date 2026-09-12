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

/** The scroll range as the driver measured it; a consumer measures its own layout in that moment. */
export interface ScrollLayout {
  readonly range: number;
  readonly viewport: number;
}

export interface ScrollDriverOptions {
  onFrame(frame: ScrollFrame): void;
  /** Transitions only, never an opening call: seed from the first frame's ScrollFrame.settled. */
  onSettle(settled: boolean, u: number): void;
  /** The measure moment: the first frame, a resize, a return to the tab, an anchor jump on a stale
   *  layout. The one place a consumer may read the document too; never per frame. */
  onMeasure?(layout: ScrollLayout): void;
  /** Damping rate; Infinity under reduced motion makes uSmooth follow u exactly (D8). */
  readonly lambda?: number;
  readonly holdMs?: number;
  readonly maxDt?: number;
  /** false: start() wires the listeners and seeds the clock but schedules no animation frames; a
   *  scene loop calls frame(now) itself. Default true. */
  readonly loop?: boolean;
}

export interface ScrollDriver {
  /** One step; start() runs it from its own rAF loop, a scene loop may call it directly. */
  frame(now: number): void;
  start(): void;
  stop(): void;
  /** Marks the layout stale: maxScroll is re-read at the top of the next frame. */
  invalidate(): void;
}

const positive = (name: string, value: number): number => {
  if (!(value > 0)) throw new RangeError(`${name} must be a positive number, got ${value}`);
  return value;
};
const finite = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a finite number >= 0, got ${value}`);
  return value;
};

export function createScrollDriver(options: ScrollDriverOptions): ScrollDriver {
  // NaN would poison uSmooth for the life of the page and read as settled; Infinity is the
  // reduced-motion rate and passes.
  const lambda = positive('lambda', options.lambda ?? 5);
  const holdMs = finite('holdMs', options.holdMs ?? 400);
  const maxDt = positive('maxDt', finite('maxDt', options.maxDt ?? 0.05));
  const loop = options.loop ?? true;

  let running = false;
  let handle = 0;
  let stale = true;
  let seeded = false;
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
    const viewport = root.clientHeight;
    maxScroll = root.scrollHeight - viewport;
    epsilon = maxScroll > 0 ? 0.25 / maxScroll : 1e-4; // a quarter of a CSS pixel at any runway
    stale = false;
    options.onMeasure?.({ range: maxScroll, viewport });
  };
  const invalidate = (): void => { stale = true; };
  const observer = new ResizeObserver(invalidate);

  const frame = (now: number): void => {
    const y = window.scrollY;
    if (stale) measure();
    // The first frame after a seed (or ever) integrates nothing: no clock to measure against.
    const dt = seeded ? Math.min(Math.max(now - last, 0) / 1000, maxDt) : 0;
    seeded = true;
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
    try {
      frame(now);
    } finally {
      // A consumer that stopped and restarted the driver inside its frame has already scheduled
      // the next one; a consumer that threw still leaves the loop alive.
      if (running && handle === 0) handle = requestAnimationFrame(tick);
    }
  };

  // rAF does not run while hidden, so the first frame back would see the whole away time.
  const resync = (): void => {
    measure();
    last = performance.now();
    seeded = true;
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
      if (loop) handle = requestAnimationFrame(tick);
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
