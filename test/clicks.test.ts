// The decisions the click hook makes without a DOM: which clicks are plain activations, which
// links may be held, how long, and which beat an element yields.
import { expect, test } from 'vitest';
import { beatFor, clampHold, isHoldable, isPlainActivation, MAX_HOLD_MS } from '../src/beat/clicks.ts';

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
