// The poster's two crop rectangles: the column inside a rendered viewport (device pixels), and the
// band's head-and-shoulders window inside that column.
import { expect, test } from 'vitest';
import { posterCrop } from '../src/island/poster.ts';
import { ASPECT, bandWindow } from '../src/pipeline/band.ts';

test('the column is centred on strip-x, sized min(38vw, 460) x height, scaled by the pixel ratio', () => {
  expect(posterCrop({ width: 1440, height: 900, ratio: 2 }, 0.46, 460, 1300)).toEqual({ x: 2 * (0.46 * 1440 - 230), y: 2 * (450 - 650), w: 920, h: 2600 });
  expect(posterCrop({ width: 1024, height: 768, ratio: 1 }, 0.4, 460, 1300)).toEqual({ x: 0.4 * 1024 - 194.56, y: 384 - 650, w: 389.12, h: 1300 });
});

test('the band window is a head-and-shoulders crop, cutting the figure instead of containing it', () => {
  // The measured capture: a 920x2600 column whose figure runs from row 1274 to 2143, head centre 387.5.
  const band = bandWindow({ width: 920, height: 2600 }, 1274, 387.5, ASPECT);
  expect(band).toEqual({ left: 170, top: 1206, width: 435, height: 676 });
  // The defect this replaces: a window taller than the whole figure, which bottom-aligned itself and
  // left 39 % of the band as empty paper over a small full-length bust.
  expect(band.top + band.height).toBeLessThan(1274 + 870);
});

test('the band window never leaves the column, wherever the head sits', () => {
  expect(bandWindow({ width: 920, height: 2600 }, 0, 10, ASPECT)).toEqual({ left: 0, top: 0, width: 435, height: 676 });
});
