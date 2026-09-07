// The sprite paths are pasted, not generated: pin each path's length and sha256 prefix
// against the upstream files (simple-icons 16.30.0, Phosphor core 2.1.1) so a mis-paste
// fails here instead of rendering a broken glyph.
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { en } from '../src/content/en.ts';
import { ICONS, renderSprite } from '../src/dom/icons.ts';
import { renderBody } from '../src/dom/render.ts';

const PINS: Record<keyof typeof ICONS, [number, string]> = {
  vk: [1172, '07ccd40f1c97262c'],
  telegram: [630, '1ffe322eb915bb2d'],
  github: [712, 'd82e21f6c9bfbfd8'],
  gmail: [230, '46333fca9d75b04e'],
  download: [217, '2626354a8633ea3c'],
  'download-bold': [216, 'cc53b36d35a865e7'],
};

test.each(Object.entries(PINS))('%s path matches upstream', (id, [len, sha]) => {
  const d = ICONS[id as keyof typeof ICONS].d;
  expect(d).toHaveLength(len);
  expect(createHash('sha256').update(d).digest('hex').slice(0, 16)).toBe(sha);
});

test('sprite: six symbols, hidden, no fill-rule', () => {
  const sprite = renderSprite();
  expect(sprite.match(/<symbol /g)).toHaveLength(6);
  expect(sprite).toContain('aria-hidden="true"');
  expect(sprite).not.toMatch(/fill-rule/);
});

// The <use> ids are typed (IconId), but a symbol could still be dropped from the sprite
// while a reference to it survives; an unresolved <use> renders an empty 20x20 box.
test('every <use> in the body resolves to a sprite symbol', () => {
  const ids = [...renderBody(en).matchAll(/href="#i-([\w-]+)"/g)].map((m) => m[1]);
  const symbols = [...renderSprite().matchAll(/id="i-([\w-]+)"/g)].map((m) => m[1]);
  expect(ids.length).toBeGreaterThan(0);
  expect([...new Set(ids)].filter((id) => !symbols.includes(id))).toEqual([]);
});
