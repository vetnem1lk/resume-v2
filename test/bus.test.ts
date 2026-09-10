// The bus is the only channel between the document and the character: named and wildcard
// delivery, signal unsubscribe, and the order nested beats arrive in.
import { expect, test, vi } from 'vitest';
import { BEATS, BeatBus, type Beat } from '../src/beat/bus.ts';

const beat = (name: Beat['name'], at = 0): Beat => ({ name, source: 'scroll', at });

test('the vocabulary is closed and unique', () => {
  expect(new Set(BEATS).size).toBe(BEATS.length);
  expect(BEATS).toContain('scroll:settle');
  expect(BEATS.filter((n) => n.startsWith('nav:'))).toHaveLength(8);
});

test('delivers to the named subscriber and to the wildcard with the same payload', () => {
  const b = new BeatBus();
  const named = vi.fn<(beat: Beat) => void>();
  const any = vi.fn<(beat: Beat) => void>();
  b.on('scroll:top', named);
  b.on('*', any);
  const payload = beat('scroll:top', 42);
  b.emit(payload);
  b.emit(beat('scroll:bottom'));
  expect(named).toHaveBeenCalledTimes(1);
  expect(named.mock.calls[0][0]).toBe(payload);
  expect(any).toHaveBeenCalledTimes(2);
});

test('an aborted signal removes the subscriber', () => {
  const b = new BeatBus();
  const handler = vi.fn<(beat: Beat) => void>();
  const controller = new AbortController();
  b.on('*', handler, { signal: controller.signal });
  b.emit(beat('scroll:start'));
  controller.abort();
  b.emit(beat('scroll:start'));
  expect(handler).toHaveBeenCalledTimes(1);
});

test('a beat emitted from inside a handler is delivered depth-first', () => {
  const b = new BeatBus();
  const order: string[] = [];
  b.on('scroll:start', () => { order.push('outer-1'); b.emit(beat('scroll:settle')); });
  b.on('scroll:settle', () => order.push('inner'));
  b.on('scroll:start', () => order.push('outer-2'));
  b.emit(beat('scroll:start'));
  expect(order).toEqual(['outer-1', 'inner', 'outer-2']);
});
