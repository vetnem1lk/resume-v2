// The camera anchor table (design SSoT section 2, D4): the body height each section frames, and
// the scroll progress at which the camera reaches it. Heights are constants; the keys are MEASURED
// from the live document (block heights overflow, the strip is in flow, the mobile layout has no
// svh table), never derived from CSS. offsetTop is not used: it is relative to .doc. A landing key
// is clamped to the scrollable range, so two on the same bound collapse and sanitizeKeys drops the later.
import { SECTION_IDS, type SectionId } from '../content/types.ts';
import { sanitizeKeys } from './pchip.ts';

/** Look-target height per section, metres above the floor. */
export const ANCHOR_Y: Readonly<Record<SectionId, number>> = {
  top: 1.7, profile: 1.3, projects: 1.0, experience: 0.85,
  skills: 0.48, education: 0.25, achievements: 0.05, contact: 0,
};

export interface SectionBox {
  readonly id: SectionId;
  /** Document-space top and height, CSS px. */
  readonly top: number;
  readonly height: number;
  /** Computed scroll-margin-top, CSS px: where an anchor jump lands. */
  readonly scrollMargin: number;
}

export interface Layout {
  /** Scrollable range: documentElement.scrollHeight - clientHeight. */
  readonly range: number;
  readonly viewport: number;
}

/** 'landing': the scroll position an anchor-pill click lands on, clamped to the scrollable range
 *  because the browser clamps scrollTo; 'centre': the section centre crossing the viewport centre.
 *  Founder call (Q4); the default is the landing rule. */
export type KeyRule = 'landing' | 'centre';

export interface SectionKey {
  readonly id: SectionId;
  readonly u: number;
  readonly y: number;
}

/** The browser stops at the ends of the scrollable range, so a landing key does too. */
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function sectionKeys(boxes: readonly SectionBox[], layout: Layout, rule: KeyRule = 'landing'): SectionKey[] {
  if (!(layout.range > 0)) return [];
  const at = (b: SectionBox): number =>
    rule === 'landing'
      ? clamp(b.top - b.scrollMargin, 0, layout.range)
      : b.top + b.height / 2 - layout.viewport / 2;
  return sanitizeKeys(boxes.map((b) => ({ id: b.id, u: at(b) / layout.range, y: ANCHOR_Y[b.id] })));
}

/** One layout read per resize, never per frame. Assumes no transformed ancestor of the sections
 *  (getBoundingClientRect is transform-sensitive); .doc carries none. */
export function measureSections(doc: Document = document): { boxes: SectionBox[]; layout: Layout } {
  const root = doc.documentElement;
  const origin = doc.defaultView?.scrollY ?? 0;
  const boxes: SectionBox[] = [];
  for (const id of SECTION_IDS) {
    const node = doc.getElementById(id);
    if (node === null) continue;
    const rect = node.getBoundingClientRect();
    const margin = Number.parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
    boxes.push({ id, top: rect.top + origin, height: rect.height, scrollMargin: margin });
  }
  return { boxes, layout: { range: root.scrollHeight - root.clientHeight, viewport: root.clientHeight } };
}
