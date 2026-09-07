// Marks the pill of the most visible section with aria-current="location". Pure
// enhancement: without it every pill is a plain in-page link that still works.
export function mostVisible(ratios: Map<string, number>): string | null {
  let best: string | null = null;
  let max = 0;
  for (const [id, ratio] of ratios) {
    if (ratio > max) { max = ratio; best = id; }
  }
  return best;
}

export function trackActiveSection(doc: Document = document): () => void {
  const links = new Map<string, HTMLAnchorElement>();
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('nav.pills a[href^="#"]')) links.set(a.hash.slice(1), a);
  const ratios = new Map<string, number>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) ratios.set(entry.target.id, entry.intersectionRatio);
      const current = mostVisible(ratios);
      for (const [id, a] of links) {
        if (id === current) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  for (const id of links.keys()) {
    const section = doc.getElementById(id);
    if (section) observer.observe(section);
  }
  return () => observer.disconnect();
}
