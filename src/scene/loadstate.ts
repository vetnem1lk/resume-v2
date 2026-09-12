// The loader as a pure state machine (design SSoT section 3): bytes arrive, the GLB parses, the
// programs compile, two frames render, then the poster gives way. The island feeds it events and
// reads one phase; no promise, no DOM, so every path is exercised under Node. S6 reads `pct` for
// the dissolve; S4 reads `phase` for the cross-fade.

export type LoadPhase = 'poster' | 'fetching' | 'parsing' | 'compiling' | 'warming' | 'live' | 'failed';

export interface LoadState {
  readonly phase: LoadPhase;
  /** Integer 0..100: the byte progress, held at HOLD_PCT until the scene is live. */
  readonly pct: number;
  /** Frames rendered since the compile resolved. */
  readonly frames: number;
  readonly reason: string;
}

export type LoadEvent =
  | { readonly type: 'start' }
  | { readonly type: 'bytes'; readonly received: number; readonly total: number }
  | { readonly type: 'fetched' }
  | { readonly type: 'parsed' }
  | { readonly type: 'compiled' }
  | { readonly type: 'frame' }
  | { readonly type: 'fail'; readonly reason: string };

/** The dissolve stops here until the programs are linked and two frames are on screen. */
export const HOLD_PCT = 92;
export const WARM_FRAMES = 2;

export const INITIAL_LOAD: LoadState = { phase: 'poster', pct: 0, frames: 0, reason: '' };

/** Integer 0..100, safe against a zero or absent denominator. */
export function progressPct(received: number, total: number): number {
  if (!(total > 0) || !(received > 0)) return 0;
  return Math.min(100, Math.floor((received / total) * 100));
}

export function loadStep(state: LoadState, event: LoadEvent): LoadState {
  if (state.phase === 'failed' || state.phase === 'live') return state;
  switch (event.type) {
    case 'fail':
      return { ...state, phase: 'failed', reason: event.reason };
    case 'start':
      return state.phase === 'poster' ? { ...state, phase: 'fetching' } : state;
    case 'bytes':
      return state.phase === 'fetching' ? { ...state, pct: Math.min(HOLD_PCT, progressPct(event.received, event.total)) } : state;
    case 'fetched':
      return state.phase === 'fetching' ? { ...state, phase: 'parsing', pct: HOLD_PCT } : state;
    case 'parsed':
      return state.phase === 'parsing' ? { ...state, phase: 'compiling' } : state;
    case 'compiled':
      return state.phase === 'compiling' ? { ...state, phase: 'warming', frames: 0 } : state;
    case 'frame': {
      if (state.phase !== 'warming') return state;
      const frames = state.frames + 1;
      return frames >= WARM_FRAMES ? { ...state, phase: 'live', pct: 100, frames } : { ...state, frames };
    }
    default:
      return state;
  }
}
