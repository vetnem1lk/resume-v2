// Motion and pointer capability, read from the primary input mechanism. any-pointer / any-hover
// misclassify a touchscreen laptop and a stylus phone, so they are not used. A UA may report
// pointer: coarse on a fine device for accessibility; camera-only is the intended outcome there.

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
export const FINE_POINTER = '(hover: hover) and (pointer: fine)';

/** Calls onChange now and on every change; returns the unsubscribe. */
export function watchMedia(query: string, onChange: (matches: boolean) => void): () => void {
  const list = window.matchMedia(query);
  const handle = (): void => onChange(list.matches);
  list.addEventListener('change', handle);
  onChange(list.matches);
  return () => list.removeEventListener('change', handle);
}
