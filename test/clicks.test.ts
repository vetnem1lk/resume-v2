// The decisions the click hook makes without a DOM: which clicks are plain activations, which
// links may be held, how long, and which beat an element yields - then the hold contract itself.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Beat, BeatBus } from '../src/beat/bus.ts';
import { beatFor, clampHold, isHoldable, isPlainActivation, MAX_HOLD_MS, wireClicks } from '../src/beat/clicks.ts';

const click = (over: Partial<MouseEvent> = {}): MouseEvent =>
  ({ isTrusted: true, button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false, ...over }) as MouseEvent;

const anchor = (href: string, target = '', attrs: Record<string, string> = {}): HTMLAnchorElement =>
  ({ href, target, hasAttribute: (n: string) => n in attrs }) as unknown as HTMLAnchorElement;

const here = new URL('https://resume.cryzothic.tech/');

test('a trusted primary click without modifiers is a plain activation', () => {
  expect(isPlainActivation(click())).toBe(true);
  expect(isPlainActivation(click({ detail: 0 }))).toBe(true); // keyboard Enter is a trusted click too
});

test('synthetic, modified and already-handled clicks are not', () => {
  expect(isPlainActivation(click({ isTrusted: false }))).toBe(false);
  expect(isPlainActivation(click({ metaKey: true }))).toBe(false);
  expect(isPlainActivation(click({ ctrlKey: true }))).toBe(false);
  expect(isPlainActivation(click({ shiftKey: true }))).toBe(false);
  expect(isPlainActivation(click({ altKey: true }))).toBe(false);
  expect(isPlainActivation(click({ defaultPrevented: true }))).toBe(false);
});

test('only a click that keeps this document alive can be held', () => {
  expect(isHoldable(anchor('https://github.com/vetnem1lk', '_blank'), here)).toBe(true);
  expect(isHoldable(anchor('mailto:klimentev.vlad@gmail.com'), here)).toBe(true);
  expect(isHoldable(anchor('https://resume.cryzothic.tech/#skills'), here)).toBe(false);
  expect(isHoldable(anchor('https://resume.cryzothic.tech/ru/'), here)).toBe(false);
  expect(isHoldable(anchor('https://resume.cryzothic.tech/cv/x.pdf', '', { download: '' }), here)).toBe(false);
  expect(isHoldable(anchor('https://resume.cryzothic.tech/cv/x.pdf', '_blank', { download: '' }), here)).toBe(false);
});

test('the hold is capped at the WebKit-safe budget and junk floors at zero', () => {
  expect(clampHold(2000)).toBe(MAX_HOLD_MS);
  expect(clampHold(400)).toBe(400);
  expect(clampHold(Number.NaN)).toBe(0);
  expect(clampHold(-1)).toBe(0);
});

test('beatFor reads the element and tells a keyboard activation from a pointer', () => {
  const el = { dataset: { beat: 'contact:vk' } } as unknown as HTMLElement;
  expect(beatFor(el, 1, 10)).toMatchObject({ name: 'contact:vk', source: 'click', at: 10, target: el });
  expect(beatFor(el, 0, 10)?.source).toBe('key');
  expect(beatFor(null, 1, 10)).toBeNull();
  expect(beatFor({ dataset: {} } as unknown as HTMLElement, 1, 10)).toBeNull();
});

// wireClicks is the only stateful piece: a fake document hands back the delegated handler and a
// fake anchor stands in for the DOM, so the hold contract is exercised end to end under Node.
class FakeAnchor {
  readonly dataset: { beat?: string } = { beat: 'contact:github' };
  readonly href = 'https://github.com/vetnem1lk';
  readonly target = '_blank';
  readonly click = vi.fn<() => void>();
  download = false;
  hasAttribute(): boolean { return this.download; }
  closest(): FakeAnchor { return this; }
}
// Node has no DOM, so the `origin instanceof Element` gate needs a constructor to test against.
globalThis.Element = FakeAnchor as unknown as typeof Element;

/** Wires a document whose every click lands on one holdable anchor; `hold` is the millisecond
 *  budget the subscriber asks for, or null for a bus that listens and holds nothing. */
const wire = (hold: number | null) => {
  const a = new FakeAnchor();
  const beats: string[] = [];
  const handlers: ((event: MouseEvent) => void)[] = [];
  const doc = {
    URL: here.href,
    addEventListener: (_type: string, handler: (event: MouseEvent) => void) => { handlers.push(handler); },
  } as unknown as Document;
  const bus = {
    emit: (beat: Beat) => { beats.push(beat.name); if (hold !== null) beat.hold?.(hold); },
  } as unknown as BeatBus;
  wireClicks(bus, doc);
  /** Fires one click on the anchor and returns its preventDefault spy. */
  const fire = (over: Partial<MouseEvent> = {}) => {
    const prevented = vi.fn<() => void>();
    handlers[0](click({ target: a as unknown as EventTarget, detail: 1, timeStamp: 5, preventDefault: prevented, ...over }));
    return prevented;
  };
  return { a, beats, fire };
};

describe('wireClicks', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test('a beat nobody holds leaves the browser default alone', () => {
    const { a, beats, fire } = wire(null);
    expect(fire()).not.toHaveBeenCalled();
    expect(beats).toEqual(['contact:github']);
    vi.advanceTimersByTime(MAX_HOLD_MS);
    expect(a.click).not.toHaveBeenCalled();
  });

  test('a held click is prevented once and replayed on the same anchor when the hold expires', () => {
    const { a, fire } = wire(MAX_HOLD_MS);
    expect(fire()).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MAX_HOLD_MS - 1);
    expect(a.click).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(a.click).toHaveBeenCalledTimes(1);
  });

  test('a second click inside the hold window is swallowed and beats nothing', () => {
    const { a, beats, fire } = wire(MAX_HOLD_MS);
    fire();
    expect(fire()).toHaveBeenCalledTimes(1);
    expect(beats).toEqual(['contact:github']);
    vi.advanceTimersByTime(MAX_HOLD_MS);
    expect(a.click).toHaveBeenCalledTimes(1);
  });

  test('a download anchor is never held, whatever the subscriber asks for', () => {
    const { a, fire } = wire(MAX_HOLD_MS);
    a.download = true;
    expect(fire()).not.toHaveBeenCalled();
    vi.advanceTimersByTime(MAX_HOLD_MS);
    expect(a.click).not.toHaveBeenCalled();
  });

  test('the replayed synthetic click beats nothing and starts no second hold', () => {
    const { a, beats, fire } = wire(MAX_HOLD_MS);
    fire();
    vi.advanceTimersByTime(MAX_HOLD_MS);
    expect(fire({ isTrusted: false })).not.toHaveBeenCalled();
    expect(beats).toEqual(['contact:github']);
    vi.advanceTimersByTime(MAX_HOLD_MS);
    expect(a.click).toHaveBeenCalledTimes(1);
  });
});
