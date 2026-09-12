// Turns the scroll driver's RAW u (never uSmooth: a beat describes the reader's input) into beats:
// section arrivals in both directions, the two document edges and a fling. Start and settle are
// the driver's camera-settle transitions and are emitted by the caller. Pure: state in, state and
// beats out, so the whole vocabulary is exercised in Node.
import type { Beat } from './bus.ts';

export interface SectionKeyLike {
  readonly id: string;
  readonly u: number;
}

export interface ScrollBeatState {
  readonly u: number;
  readonly topArmed: boolean;
  readonly bottomArmed: boolean;
  readonly flinging: boolean;
}

export interface ScrollBeatOptions {
  /** Distance from an edge that counts as reaching it (u === 1 is not always reachable). */
  readonly edge: number;
  /** Distance the reader must move away before an edge beat may fire again. */
  readonly edgeRearm: number;
  /** Speed, u per second, above which a scroll is a fling; released below 60 % of it. */
  readonly fling: number;
  /** A single-frame move larger than this is an anchor jump, not a scroll. */
  readonly jump: number;
}

export const SCROLL_BEAT_DEFAULTS: ScrollBeatOptions = { edge: 0.004, edgeRearm: 0.03, fling: 0.35, jump: 0.05 };

export function initialScrollBeatState(u: number, options: ScrollBeatOptions = SCROLL_BEAT_DEFAULTS): ScrollBeatState {
  return { u, topArmed: u > options.edge, bottomArmed: u < 1 - options.edge, flinging: false };
}

export function scrollBeats(
  prev: ScrollBeatState,
  u: number,
  dt: number,
  keys: readonly SectionKeyLike[],
  at: number,
  options: ScrollBeatOptions = SCROLL_BEAT_DEFAULTS,
): { state: ScrollBeatState; beats: Beat[] } {
  const velocity = dt > 0 ? (u - prev.u) / dt : 0;
  const speed = Math.abs(velocity);
  const beats: Beat[] = [];
  const scroll = (name: Beat['name'], data?: Beat['data']): void => {
    beats.push({ name, source: 'scroll', at, data });
  };

  // An anchor click moves u the whole way in one frame: emit the destination, not the journey.
  const teleport = Math.abs(u - prev.u) > options.jump;

  const flinging = teleport
    ? false
    : speed >= options.fling ? true : speed < options.fling * 0.6 ? false : prev.flinging;
  if (flinging && !prev.flinging) scroll('scroll:fling', { direction: velocity > 0 ? 1 : -1, velocity });

  const forward = u > prev.u;
  // Inclusive at the frame's destination end and exclusive at its origin, in both directions: a key
  // sitting on a frame boundary is emitted once, whether the reader continues or reverses.
  const crossed = keys.filter((k) => (forward ? prev.u < k.u && k.u <= u : u <= k.u && k.u < prev.u));
  const ordered = crossed.toSorted((a, b) => (forward ? a.u - b.u : b.u - a.u));
  const arrivals = teleport ? ordered.slice(-1) : ordered;
  for (const key of arrivals) scroll('scroll:arrive', { section: key.id, direction: forward ? 1 : -1, velocity });

  let topArmed = prev.topArmed;
  if (u <= options.edge && topArmed) { scroll('scroll:top', { u }); topArmed = false; }
  else if (u > options.edge + options.edgeRearm) topArmed = true;

  let bottomArmed = prev.bottomArmed;
  if (u >= 1 - options.edge && bottomArmed) { scroll('scroll:bottom', { u }); bottomArmed = false; }
  else if (u < 1 - options.edge - options.edgeRearm) bottomArmed = true;

  return { state: { u, topArmed, bottomArmed, flinging }, beats };
}
