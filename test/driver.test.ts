// The rAF driver under a hand-rolled window: no DOM library (they report every layout metric as
// zero), so the fake carries exactly the reads the driver makes plus a manual animation-frame queue.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createScrollDriver, type ScrollFrame, type ScrollLayout } from '../src/scroll/driver.ts';

type Handler = () => void;

interface FakeWindow {
  scrollY: number;
  scrollHeight: number;
  clientHeight: number;
  /** Runs every queued animation frame once with the given timestamp. */
  runFrames(now: number): void;
  pending(): number;
  fire(type: string): void;
}

function installWindow(): FakeWindow {
  const listeners = new Map<string, Handler[]>();
  const queue = new Map<number, (now: number) => void>();
  let nextHandle = 1;
  const on = (type: string, handler: Handler): void => { listeners.set(type, [...(listeners.get(type) ?? []), handler]); };
  const off = (type: string, handler: Handler): void => { listeners.set(type, (listeners.get(type) ?? []).filter((h) => h !== handler)); };
  const fake: FakeWindow = {
    scrollY: 0,
    scrollHeight: 8000,
    clientHeight: 1000,
    runFrames(now) {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(now);
    },
    pending: () => queue.size,
    fire(type) { for (const handler of listeners.get(type) ?? []) handler(); },
  };
  vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void): number => {
    const handle = nextHandle;
    nextHandle += 1;
    queue.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => { queue.delete(handle); });
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
  vi.stubGlobal('document', {
    documentElement: { get scrollHeight() { return fake.scrollHeight; }, get clientHeight() { return fake.clientHeight; } },
    visibilityState: 'visible',
    addEventListener: on,
    removeEventListener: off,
  });
  vi.stubGlobal('window', {
    get scrollY() { return fake.scrollY; },
    addEventListener: on,
    removeEventListener: off,
    visualViewport: { addEventListener: on, removeEventListener: off },
  });
  return fake;
}

let fake: FakeWindow;
beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  fake = installWindow();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const noSettle = (): void => {};

test('loop: false wires the driver without scheduling a frame; a scene loop steps it', () => {
  const frames: ScrollFrame[] = [];
  const driver = createScrollDriver({ loop: false, onFrame: (f) => frames.push(f), onSettle: noSettle });
  driver.start();
  expect(fake.pending()).toBe(0);
  fake.scrollY = 3500;
  vi.advanceTimersByTime(16);
  driver.frame(16);
  driver.frame(32);
  expect(frames.map((f) => f.dt)).toEqual([0.016, 0.016]);
  expect(frames[1]?.u).toBe(0.5);
  driver.stop();
});

test('a frame before any seed integrates nothing instead of the clamp', () => {
  const frames: ScrollFrame[] = [];
  const driver = createScrollDriver({ loop: false, onFrame: (f) => frames.push(f), onSettle: noSettle });
  driver.frame(5000);
  driver.frame(5016);
  expect(frames.map((f) => f.dt)).toEqual([0, 0.016]);
});

test('onMeasure fires at the measure moments only, never per frame', () => {
  const layouts: ScrollLayout[] = [];
  const driver = createScrollDriver({ onFrame: () => {}, onSettle: noSettle, onMeasure: (l) => layouts.push(l) });
  driver.start();
  expect(layouts).toEqual([{ range: 7000, viewport: 1000 }]);
  fake.runFrames(16);
  fake.runFrames(32);
  expect(layouts).toHaveLength(1);
  fake.clientHeight = 800;
  driver.invalidate();
  fake.runFrames(48);
  fake.runFrames(64);
  expect(layouts).toEqual([{ range: 7000, viewport: 1000 }, { range: 7200, viewport: 800 }]);
  fake.fire('visibilitychange');
  expect(layouts).toHaveLength(3);
  driver.stop();
});

test('a throwing consumer leaves the loop alive, and stop then start restart it cleanly', () => {
  let calls = 0;
  const driver = createScrollDriver({
    onFrame: () => { calls += 1; if (calls === 1) throw new Error('consumer bug'); },
    onSettle: noSettle,
  });
  driver.start();
  expect(() => fake.runFrames(16)).toThrow('consumer bug');
  expect(fake.pending()).toBe(1);
  fake.runFrames(32);
  expect(calls).toBe(2);
  driver.stop();
  expect(fake.pending()).toBe(0);
  driver.start();
  expect(fake.pending()).toBe(1);
  driver.stop();
});

test('stop and start inside a frame schedule exactly one next frame', () => {
  let first = true;
  const driver = createScrollDriver({
    onFrame: () => { if (first) { first = false; driver.stop(); driver.start(); } },
    onSettle: noSettle,
  });
  driver.start();
  fake.runFrames(16);
  expect(fake.pending()).toBe(1);
  driver.stop();
});

test('an anchor jump snaps the damped progress onto the new position', () => {
  const frames: ScrollFrame[] = [];
  const driver = createScrollDriver({ onFrame: (f) => frames.push(f), onSettle: noSettle });
  driver.start();
  fake.runFrames(16);
  fake.scrollY = 3500;
  fake.fire('hashchange');
  fake.runFrames(32);
  expect(frames[1]?.uSmooth).toBe(0.5);
  driver.stop();
});

test('rejects options that would poison the damping or the settle clock', () => {
  const base = { onFrame: (): void => {}, onSettle: noSettle };
  expect(() => createScrollDriver({ ...base, lambda: Number.NaN })).toThrow(RangeError);
  expect(() => createScrollDriver({ ...base, lambda: 0 })).toThrow(RangeError);
  expect(() => createScrollDriver({ ...base, holdMs: -1 })).toThrow(RangeError);
  expect(() => createScrollDriver({ ...base, maxDt: 0 })).toThrow(RangeError);
  expect(() => createScrollDriver({ ...base, maxDt: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  expect(() => createScrollDriver({ ...base, lambda: Number.POSITIVE_INFINITY })).not.toThrow();
});
