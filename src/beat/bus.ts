// The page's interaction bus. Clicks on [data-beat] anchors and the scroll driver publish "beats";
// the character island subscribes and reacts. One EventTarget, one event type, the name inside
// detail; no three.js and no DOM library, so the whole bus is testable under Node.

export const BEATS = [
  'nav:top', 'nav:profile', 'nav:projects', 'nav:experience',
  'nav:skills', 'nav:education', 'nav:achievements', 'nav:contact',
  'contact:vk', 'contact:telegram', 'contact:github', 'contact:email',
  'cv:en', 'cv:ru', 'cv:en-ats', 'cv:ru-ats',
  'lang:en', 'lang:ru', 'link:v1', 'link:more', 'project:link',
  'scroll:start', 'scroll:settle', 'scroll:arrive', 'scroll:top', 'scroll:bottom', 'scroll:fling',
] as const;

export type BeatName = (typeof BEATS)[number];
export type BeatSource = 'click' | 'key' | 'scroll';

export interface Beat {
  name: BeatName;
  source: BeatSource;
  /** performance.now() clock: event.timeStamp for clicks, the rAF timestamp for scroll beats. */
  at: number;
  target?: HTMLElement;
  data?: { section?: string; direction?: 1 | -1; velocity?: number; u?: number };
  /** Click beats only: ask the hook to delay the link's default by up to MAX_HOLD_MS.
   *  Synchronous, milliseconds, true when accepted. */
  hold?(ms: number): boolean;
}

const EVENT = 'beat';

export class BeatBus extends EventTarget {
  /** Subscribes; the AbortSignal is the only unsubscribe channel. Handlers must not throw. */
  on(name: BeatName | '*', handler: (beat: Beat) => void, options?: { signal?: AbortSignal }): void {
    this.addEventListener(EVENT, (event) => {
      const beat = (event as CustomEvent<Beat>).detail;
      if (name === '*' || beat.name === name) handler(beat);
    }, { signal: options?.signal });
  }

  emit(beat: Beat): void {
    this.dispatchEvent(new CustomEvent<Beat>(EVENT, { detail: beat }));
  }
}

export const bus = new BeatBus();
