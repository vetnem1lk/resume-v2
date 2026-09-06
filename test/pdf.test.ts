// The four CV files are copies of the shipped PDFs; their byte sizes are pinned so a
// silent re-export or a half-copied public/cv shows up here, not on a recruiter's screen.
import { statSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CV_FILES } from '../src/content/shared.ts';

test.each(CV_FILES)('$file is $bytes bytes', ({ file, bytes }) => {
  expect(statSync(new URL(`../public${file}`, import.meta.url)).size).toBe(bytes);
});
