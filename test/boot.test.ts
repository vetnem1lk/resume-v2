// boot() never rejects: a gate refusal, a rejecting chunk import and a throwing mount all leave
// the poster; readEnv reads the three signals off a fake window.
import { expect, test, vi } from 'vitest';
import { boot, readEnv, type IslandModule } from '../src/scene/boot.ts';

const env = { wide: true, webgl2: true, saveData: false };

test('a gate refusal never loads the chunk', async () => {
  const load = vi.fn<() => Promise<IslandModule>>();
  await expect(boot({ ...env, wide: false }, load)).resolves.toEqual({ kind: 'poster', reason: 'narrow' });
  expect(load).not.toHaveBeenCalled();
});

test('a rejecting chunk import leaves the poster, is reported, and is never retried', async () => {
  const load = vi.fn<() => Promise<IslandModule>>().mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
  await expect(boot(env, load)).resolves.toEqual({ kind: 'poster', reason: 'chunk: Failed to fetch dynamically imported module' });
  expect(load).toHaveBeenCalledTimes(1);
});

test('a throwing mount is a poster too; a good one is the island', async () => {
  const bad = vi.fn<() => Promise<IslandModule>>().mockResolvedValue({ mount: () => { throw new Error('no context'); } });
  await expect(boot(env, bad)).resolves.toEqual({ kind: 'poster', reason: 'chunk: no context' });
  const mount = vi.fn<() => void>();
  await expect(boot(env, () => Promise.resolve({ mount }))).resolves.toEqual({ kind: 'island' });
  expect(mount).toHaveBeenCalledTimes(1);
});

test('readEnv reads matchMedia, the WebGL2 constructor and saveData off a window', () => {
  const win = {
    matchMedia: (q: string) => ({ matches: q === '(min-width: 1024px)' }),
    navigator: { connection: { saveData: true } },
    WebGL2RenderingContext: {},
  } as unknown as Window;
  expect(readEnv(win)).toEqual({ wide: true, webgl2: true, saveData: true });
  expect(readEnv({ matchMedia: () => ({ matches: false }), navigator: {} } as unknown as Window)).toEqual({ wide: false, webgl2: false, saveData: false });
});
