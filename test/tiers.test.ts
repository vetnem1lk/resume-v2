// The tier pump on fake materials: sampler state carried over, a replaced texture disposed once and
// only when its last holder let go, one adoption per tick, a rejected entry skipped without a retry.
import { expect, test, vi } from 'vitest';
import { adoptSampler, createTierPump, swapMap } from '../src/island/tiers.ts';

const texture = (name: string) => ({ name, wrapS: 1000, wrapT: 1000, channel: 0, anisotropy: 1, flipY: false, colorSpace: 'srgb', offset: { copy: vi.fn<() => void>() }, repeat: { copy: vi.fn<() => void>() }, center: { copy: vi.fn<() => void>() }, rotation: 0, needsUpdate: false, dispose: vi.fn<() => void>() });
const material = (name: string, map: unknown) => ({ name, map, aoMap: null, roughnessMap: null, metalnessMap: null, isMaterial: true });
const mesh = (mat: unknown) => ({ isMesh: true, material: mat, children: [] as unknown[], traverse(cb: (o: unknown) => void) { cb(this); for (const c of this.children) (c as { traverse(cb: (o: unknown) => void): void }).traverse(cb); } });

test('adoptSampler copies what the glTF sampler decided and flags the upload', () => {
  const prev = { ...texture('old'), wrapS: 1001, channel: 1, anisotropy: 4, rotation: 0.5 };
  const next = texture('new');
  adoptSampler(next as never, prev as never);
  expect(next).toMatchObject({ wrapS: 1001, channel: 1, anisotropy: 4, rotation: 0.5, needsUpdate: true });
  expect(next.offset.copy).toHaveBeenCalledWith(prev.offset);
});

test('swapMap replaces every holder of the material and disposes the old texture once', () => {
  const old = texture('old');
  const a = material('MAT_HEAD', old);
  const b = material('MAT_HEAD', old);
  const body = texture('body');
  const other = material('MAT_BODY', body);
  const root = mesh(a);
  root.children.push(mesh(b), mesh(other));
  const next = texture('new');
  expect(swapMap(root as never, 'MAT_HEAD', 'map', next as never)).toBe(2);
  expect(a.map).toBe(next);
  expect(b.map).toBe(next);
  expect(other.map).toBe(body);
  expect(old.dispose).toHaveBeenCalledTimes(1);
});

test('a texture two material names share outlives the swap of one of them', () => {
  const shared = texture('eyes_bc');               // the GLB has one: MAT_EYE_R and MAT_EYE_L
  const right = material('MAT_EYE_R', shared);
  const left = material('MAT_EYE_L', shared);
  const root = mesh(right);
  root.children.push(mesh(left));
  expect(swapMap(root as never, 'MAT_EYE_R', 'map', texture('right') as never)).toBe(1);
  expect(left.map).toBe(shared);
  expect(shared.dispose).not.toHaveBeenCalled();   // disposing it here duplicates the GL texture
  expect(swapMap(root as never, 'MAT_EYE_L', 'map', texture('left') as never)).toBe(1);
  expect(shared.dispose).toHaveBeenCalledTimes(1); // the last holder let go
});

test('the pump adopts one entry per tick and skips a rejected one without retrying', async () => {
  const good = texture('head2k');
  const load = vi.fn<(url: string) => Promise<unknown>>().mockImplementation((url) => (url.includes('bad') ? Promise.reject(new Error('404')) : Promise.resolve(good)));
  const renderer = { initTexture: vi.fn<() => void>() };
  const root = mesh(material('MAT_HEAD', texture('head1k')));
  root.children.push(mesh(material('MAT_HAIR', texture('hair1k'))));
  const pump = createTierPump(root as never, renderer as never, [
    { material: 'MAT_HEAD', slot: 'map', url: '/x/head_bc@2048.ktx2' },
    { material: 'MAT_HAIR', slot: 'map', url: '/x/bad.ktx2' },
  ], load as never);
  pump.tick();                                  // starts the first load
  await Promise.resolve(); await Promise.resolve();
  pump.tick();                                  // adopts head, starts the second load
  expect(renderer.initTexture).toHaveBeenCalledTimes(1);
  await Promise.resolve(); await Promise.resolve();
  pump.tick();                                  // the rejected entry is skipped
  pump.tick();
  expect(load).toHaveBeenCalledTimes(2);
  expect(pump.done()).toBe(true);
  // The DEV readout: holders swapped per adoption, nothing for the entry that never arrived.
  expect(pump.holders()).toEqual([1]);
});
