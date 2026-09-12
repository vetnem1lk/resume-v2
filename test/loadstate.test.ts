// The loader state machine: the happy path in order, out-of-order events ignored, the 92 % hold,
// failure from any phase, and the two terminal states that absorb everything.
import { expect, test } from 'vitest';
import { HOLD_PCT, INITIAL_LOAD, loadStep, progressPct, WARM_FRAMES, type LoadEvent, type LoadState } from '../src/scene/loadstate.ts';

const run = (events: LoadEvent[], from: LoadState = INITIAL_LOAD): LoadState => events.reduce(loadStep, from);

test('the happy path walks poster -> fetching -> parsing -> compiling -> warming -> live', () => {
  const phases: string[] = [];
  let state = INITIAL_LOAD;
  for (const event of [{ type: 'start' }, { type: 'fetched' }, { type: 'parsed' }, { type: 'compiled' }, { type: 'frame' }, { type: 'frame' }] as const) {
    state = loadStep(state, event);
    phases.push(state.phase);
  }
  expect(phases).toEqual(['fetching', 'parsing', 'compiling', 'warming', 'warming', 'live']);
  expect(state.pct).toBe(100);
  expect(state.frames).toBe(WARM_FRAMES);
});

test('bytes advance the percentage but never past the hold', () => {
  const fetching = run([{ type: 'start' }]);
  expect(loadStep(fetching, { type: 'bytes', received: 1_000_000, total: 4_044_097 }).pct).toBe(24);
  expect(loadStep(fetching, { type: 'bytes', received: 4_044_097, total: 4_044_097 }).pct).toBe(HOLD_PCT);
  expect(run([{ type: 'start' }, { type: 'fetched' }]).pct).toBe(HOLD_PCT);
});

test('events out of order are ignored', () => {
  expect(run([{ type: 'parsed' }]).phase).toBe('poster');
  expect(run([{ type: 'start' }, { type: 'compiled' }]).phase).toBe('fetching');
  expect(run([{ type: 'start' }, { type: 'frame' }]).frames).toBe(0);
  expect(run([{ type: 'start' }, { type: 'start' }]).phase).toBe('fetching');
});

test('a failure from any phase keeps the poster and records why', () => {
  for (const prefix of [[], [{ type: 'start' }], [{ type: 'start' }, { type: 'fetched' }, { type: 'parsed' }]] as const) {
    const failed = run([...prefix, { type: 'fail', reason: 'HTTP 404' }]);
    expect(failed.phase).toBe('failed');
    expect(failed.reason).toBe('HTTP 404');
  }
});

test('live and failed absorb every later event', () => {
  const live = run([{ type: 'start' }, { type: 'fetched' }, { type: 'parsed' }, { type: 'compiled' }, { type: 'frame' }, { type: 'frame' }]);
  expect(loadStep(live, { type: 'fail', reason: 'late' })).toBe(live);
  const failed = run([{ type: 'fail', reason: 'no context' }]);
  expect(loadStep(failed, { type: 'start' })).toBe(failed);
});

test('progressPct is an integer, floors, and survives a missing denominator', () => {
  expect(progressPct(0, 100)).toBe(0);
  expect(progressPct(999, 1000)).toBe(99);
  expect(progressPct(2000, 1000)).toBe(100);
  expect(progressPct(50, 0)).toBe(0);
  expect(progressPct(Number.NaN, 100)).toBe(0);
});
