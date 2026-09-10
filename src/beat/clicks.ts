// Click beats: a clicked [data-beat] anchor lets the character react before the browser follows
// the link. A subscriber may hold the default for up to 600 ms; the deferred default is a
// synthetic click on the SAME anchor, which keeps its target, rel and download semantics and goes
// through the same activation gate. Without a subscriber nothing is prevented.
import type { Beat, BeatBus, BeatName } from './bus.ts';

/** Above WebKit's 1 s gesture-forwarding window a deferred open is silently blocked. */
export const MAX_HOLD_MS = 600;

/** A click the browser would handle itself must never be intercepted: a modifier click opens a
 *  background tab (macOS ctrl+click dispatches no click at all), a synthetic click is our own
 *  replay, and an already-prevented click belongs to an inner widget. */
export function isPlainActivation(e: MouseEvent): boolean {
  return e.isTrusted && e.button === 0
    && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey
    && !e.defaultPrevented;
}

/** Only a click that keeps this document alive can show a reaction: a new tab, or a handler for
 *  another protocol (mailto:). Downloads and same-tab navigations are never held. */
export function isHoldable(a: HTMLAnchorElement, here: URL): boolean {
  if (a.hasAttribute('download')) return false;
  if (a.target === '_blank') return true;
  return new URL(a.href, here).protocol !== here.protocol;
}

export function clampHold(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, MAX_HOLD_MS) : 0;
}

/** The one decision the delegation makes: which beat, if any, an element yields.
 *  event.detail === 0 is the portable keyboard test (never pointerType). */
export function beatFor(el: HTMLElement | null, detail: number, at: number): Beat | null {
  const name = el?.dataset.beat as BeatName | undefined;
  return name && el ? { name, source: detail === 0 ? 'key' : 'click', at, target: el } : null;
}

export function wireClicks(target: BeatBus, doc: Document = document, signal?: AbortSignal): void {
  const here = new URL(doc.URL);
  let pending = false;
  doc.addEventListener('click', (event) => {
    const origin = event.target;
    if (!(origin instanceof Element)) return;
    const el = origin.closest<HTMLElement>('[data-beat]');
    if (el === null || !isPlainActivation(event)) return;
    // A repeat click while a hold is pending would navigate the resume tab away.
    if (pending) { event.preventDefault(); return; }
    const beat = beatFor(el, event.detail, event.timeStamp);
    if (beat === null) return;
    const a = el.closest('a');
    const holdable = a !== null && isHoldable(a, here);
    let ms = 0;
    beat.hold = (n) => {
      if (!holdable) return false;
      ms = Math.max(ms, clampHold(n));
      return ms > 0;
    };
    target.emit(beat);
    if (ms === 0 || a === null) return;
    event.preventDefault();
    pending = true;
    // Scheduled directly inside the click task with an interval under 1 s: Firefox forwards the
    // popup permission only from timer depth 0, WebKit only within 1 s of the gesture.
    setTimeout(() => { pending = false; a.click(); }, ms);
  }, { signal });
}
