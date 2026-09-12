// The asset host's path rule: only the public prefix, only inside the root, only the types the
// host serves - the middleware itself is exercised against the preview server, not here.
import { resolve, sep } from 'node:path';
import { expect, test } from 'vitest';
import { ASSET_PREFIX, resolveAsset } from '../src/build/assets.ts';

const root = resolve('deploy', 'g2');

test('a path under the prefix maps into the root with the host media type', () => {
  expect(resolveAsset(root, '/g2/v2/mg.glb')).toEqual({ file: [root, 'v2', 'mg.glb'].join(sep), type: 'model/gltf-binary' });
  expect(resolveAsset(root, '/g2/v2/tex/head_bc@2048.ktx2')?.type).toBe('image/ktx2');
  expect(resolveAsset(root, '/g2/v2/poster/tall-2x.avif')?.type).toBe('image/avif');
});

test('anything outside the prefix, the root or the type table is not served', () => {
  expect(resolveAsset(root, '/assets/main.js')).toBeNull();
  expect(resolveAsset(root, '/g2/../package.json')).toBeNull();
  expect(resolveAsset(root, '/g2/v2/notes.txt')).toBeNull();
  expect(resolveAsset(root, ASSET_PREFIX)).toBeNull();
});
