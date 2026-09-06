// The render contract: eight sections in the locked order, one h1, a fast path in
// the first bytes, every link labelled, both languages, no em-dash in the output.
import { describe, expect, test } from 'vitest';
import { en } from '../src/content/en.ts';
import { ru } from '../src/content/ru.ts';
import { CV_FILES } from '../src/content/shared.ts';
import { SECTION_IDS } from '../src/content/types.ts';
import { escape, renderBody, renderHead } from '../src/dom/render.ts';

describe.each([en, ru])('render $lang', (c) => {
  const body = renderBody(c);
  const head = renderHead(c);

  test('eight sections in D5 order', () => {
    const ids = [...body.matchAll(/<section[^>]*\bid="([a-z]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([...SECTION_IDS]);
  });
  test('exactly one h1, h2 per section after the header', () => {
    expect(body.match(/<h1\b/g)).toHaveLength(1);
    expect(body.match(/<h2\b/g)).toHaveLength(SECTION_IDS.length - 1);
  });
  test('anchor pills match the sections, nav is labelled', () => {
    const nav = body.match(/<nav class="pills"[\s\S]*?<\/nav>/)?.[0] ?? '';
    expect(nav).toContain(`aria-label="${c.ui.navLabel}"`);
    const hrefs = [...nav.matchAll(/href="#([a-z]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([...SECTION_IDS]);
  });
  test('fast path: name, role, CV link and contacts before the main content', () => {
    const strip = body.slice(0, body.indexOf('<main'));
    expect(strip).toContain(c.header.name);
    expect(strip).toContain(c.header.role);
    const visual = CV_FILES.find((f) => f.key === c.lang)!;
    expect(strip).toContain(`href="${visual.file}"`);
    expect(strip).toContain('https://t.me/cryzoth');
    expect(strip).toContain('https://github.com/vetnem1lk');
    expect(strip).toContain('mailto:klimentev.vlad@gmail.com');
    expect(strip).toContain(`href="${c.ui.lang.href}"`);
  });
  test('name card, icon row and CV chooser with all four PDFs', () => {
    const card = body.slice(body.indexOf('id="contact"'));
    expect(card).toContain('Vlad Klimentev C++/Qt');
    for (const href of ['https://vk.ru/vetnem1lk', 'https://t.me/cryzoth', 'https://github.com/vetnem1lk', 'mailto:klimentev.vlad@gmail.com', 'https://me.cryzothic.tech']) expect(card).toContain(`href="${href}"`);
    expect(card).toContain('<details class="cv-menu"');
    for (const f of CV_FILES) expect(card).toContain(`href="${f.file}"`);
  });
  test('every link has text or an aria-label', () => {
    for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      const text = m[2].replace(/<[^>]+>/g, '').trim();
      expect(text.length > 0 || /aria-label="[^"]+"/.test(m[1])).toBe(true);
    }
  });
  test('no em-dash, no phone', () => {
    expect(body + head).not.toMatch(/\u2014/);
    expect(body + head).not.toMatch(/950-73-77/);
  });
  test('head: title, description, canonical, three hreflang alternates, og', () => {
    expect(head).toContain(`<title>${c.meta.title}</title>`);
    expect(head).toContain(`name="description" content="${c.meta.description}"`);
    expect(head).toContain(`rel="canonical" href="https://resume.cryzothic.tech/${c.lang === 'ru' ? 'ru/' : ''}"`);
    expect(head).toContain('hreflang="en" href="https://resume.cryzothic.tech/"');
    expect(head).toContain('hreflang="ru" href="https://resume.cryzothic.tech/ru/"');
    expect(head).toContain('hreflang="x-default" href="https://resume.cryzothic.tech/"');
    expect(head).toContain(`property="og:title" content="${c.meta.title}"`);
  });
  test('stage reserves the scene without CLS hooks into the document', () => {
    expect(body).toContain('<div class="stage" aria-hidden="true">');
    expect(body).toContain('class="stage__poster"');
    expect(body).toContain('class="stage__letterform"');
    expect(body).toContain('class="stage__contour"');
    expect(body).toContain('class="stage__light"');
  });
});

test('escape', () => {
  expect(escape('a & b < "c"')).toBe('a &amp; b &lt; &quot;c&quot;');
});

const sprite = (s: string) => s.match(/<svg[^>]*class="sprite"[\s\S]*?<\/svg>/)?.[0];

test('body differs by language, sprite identical', () => {
  expect(renderBody(en)).not.toBe(renderBody(ru));
  expect(sprite(renderBody(en))).toBe(sprite(renderBody(ru)));
});
