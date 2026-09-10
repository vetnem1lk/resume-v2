// Scroll beats from raw u: arrivals in both directions, one arrival on a teleport, edges with
// hysteresis, a fling that arms and disarms. Pure, so the whole vocabulary runs in Node.
import { expect, test } from 'vitest';
import type { Beat } from '../src/beat/bus.ts';
import { initialScrollBeatState, scrollBeats } from '../src/beat/scroll.ts';

const KEYS = [{ id: 'profile', u: 0.15 }, { id: 'projects', u: 0.4 }, { id: 'contact', u: 0.97 }];
const names = (beats: { name: string }[]): string[] => beats.map((b) => b.name);
// One slow frame: a small move over half a second stays far under the fling threshold.
const step = (prevU: number, u: number, dt = 0.5) => scrollBeats(initialScrollBeatState(prevU), u, dt, KEYS, 0);
// Many small frames at 60 fps, the way a wheel scroll arrives (0.002 u per frame = 0.12 u/s).
const sweep = (from: number, to: number, frames: number) => {
  let state = initialScrollBeatState(from);
  const beats: Beat[] = [];
  for (let i = 1; i <= frames; i += 1) {
    const r = scrollBeats(state, from + ((to - from) * i) / frames, 1 / 60, KEYS, 0);
    state = r.state;
    beats.push(...r.beats);
  }
  return { state, beats };
};

test('a stationary frame emits nothing', () => {
  expect(step(0.3, 0.3).beats).toEqual([]);
});

test('a key crossed forward is crossed back when the scroll reverses', () => {
  const a = step(0.39, 0.41);
  const b = scrollBeats(a.state, 0.39, 0.5, KEYS, 0);
  expect(a.beats.map((x) => [x.name, x.data?.section, x.data?.direction])).toEqual([['scroll:arrive', 'projects', 1]]);
  expect(b.beats.map((x) => [x.name, x.data?.section, x.data?.direction])).toEqual([['scroll:arrive', 'projects', -1]]);
});

test('a key the frame ends on is emitted once, whether the reader continues or reverses', () => {
  const on = step(0.39, 0.4);                       // the frame stops exactly on the projects key
  expect(on.beats.map((x) => [x.data?.section, x.data?.direction])).toEqual([['projects', 1]]);
  expect(scrollBeats(on.state, 0.39, 0.5, KEYS, 0).beats).toEqual([]);
  expect(scrollBeats(on.state, 0.41, 0.5, KEYS, 0).beats).toEqual([]);
});

test('a backward frame ending on a key arrives there, and the frame leaving it emits nothing', () => {
  const a = step(0.41, 0.4);
  expect(a.beats.map((x) => [x.data?.section, x.data?.direction])).toEqual([['projects', -1]]);
  expect(scrollBeats(a.state, 0.39, 0.5, KEYS, 0).beats).toEqual([]);
});

test('a backward teleport arrives at the key it lands on, not the one above it', () => {
  const { beats } = step(0.99, 0.4);
  expect(names(beats)).toEqual(['scroll:arrive']);
  expect([beats[0].data?.section, beats[0].data?.direction]).toEqual(['projects', -1]);
});

test('a slow scroll across two keys arrives at both, in scroll order, with no fling', () => {
  const down = sweep(0.1, 0.42, 160);
  expect(names(down.beats)).toEqual(['scroll:arrive', 'scroll:arrive']);
  expect(down.beats.map((b) => b.data?.section)).toEqual(['profile', 'projects']);
  expect(sweep(0.42, 0.1, 160).beats.map((b) => b.data?.section)).toEqual(['projects', 'profile']);
});

test('a teleport (anchor click) arrives only at the last key and never flings', () => {
  const { beats } = step(0, 1);
  expect(names(beats)).toEqual(['scroll:arrive', 'scroll:bottom']);
  expect(beats[0].data?.section).toBe('contact');
});

test('the edges fire once and re-arm only after leaving the hysteresis band', () => {
  const a = step(0.02, 0.002);
  expect(names(a.beats)).toEqual(['scroll:top']);
  const b = scrollBeats(a.state, 0.001, 0.5, KEYS, 0);
  expect(names(b.beats)).toEqual([]);
  const c = scrollBeats(b.state, 0.02, 0.5, KEYS, 0);
  expect(c.state.topArmed).toBe(false);
  const d = scrollBeats(c.state, 0.05, 0.5, KEYS, 0);
  expect(d.state.topArmed).toBe(true);
});

test('a fling arms above the threshold and releases below 60 percent of it', () => {
  const a = step(0.3, 0.31, 1 / 60);            // 0.6 u/s
  expect(names(a.beats)).toEqual(['scroll:fling']);
  expect(a.beats[0].data?.direction).toBe(1);
  const b = scrollBeats(a.state, 0.316, 1 / 60, KEYS, 0); // 0.36 u/s: still flinging
  expect(b.state.flinging).toBe(true);
  const c = scrollBeats(b.state, 0.318, 1 / 60, KEYS, 0); // 0.12 u/s: released
  expect(c.state.flinging).toBe(false);
});

test('a zero dt yields no velocity-derived beats', () => {
  const { beats, state } = step(0.3, 0.9, 0);
  expect(names(beats)).toEqual(['scroll:arrive']);
  expect(beats[0].data?.velocity).toBe(0);
  expect(state.flinging).toBe(false);
});
