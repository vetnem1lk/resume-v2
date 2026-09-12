// The crop rectangle of the poster column inside a rendered viewport, in device pixels.
import { expect, test } from 'vitest';
import { posterCrop } from '../src/island/poster.ts';

test('the column is centred on strip-x, sized min(38vw, 460) x height, scaled by the pixel ratio', () => {
  expect(posterCrop({ width: 1440, height: 900, ratio: 2 }, 0.46, 460, 1300)).toEqual({ x: 2 * (0.46 * 1440 - 230), y: 2 * (450 - 650), w: 920, h: 2600 });
  expect(posterCrop({ width: 1024, height: 768, ratio: 1 }, 0.4, 460, 1300)).toEqual({ x: 0.4 * 1024 - 194.56, y: 384 - 650, w: 389.12, h: 1300 });
});
