// The licensed 3D asset never enters the public repository, in any form.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('no binary asset is tracked by git', () => {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const files = execFileSync('git', ['ls-files'], { cwd, encoding: 'utf8' }).split('\n');
  const banned = files.filter((f) => /\.(fbx|glb|gltf|ktx2|blend|blend1|png|tga|exr|jpg)$/i.test(f));
  expect(banned).toEqual([]);
});
