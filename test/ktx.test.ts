// The KTX2 flag table is where the colour-space correctness of every texture is decided.
import { expect, test } from 'vitest';
import { TEXTURE_PLAN, TIER1, TIER1_PICK, TIER2, bc7ChainBytes, ktxArgs, pickFile, textureVramBytes, validateArgs } from '../src/pipeline/ktx.ts';

test('colour textures are tagged sRGB + BT709 and encoded ETC1S', () => {
  const a = ktxArgs('bc', 3);
  expect(a).toContain('--format'); expect(a[a.indexOf('--format') + 1]).toBe('R8G8B8_SRGB');
  expect(a.join(' ')).toContain('--assign-tf srgb --assign-primaries bt709');
  expect(a.join(' ')).toContain('--encode basis-lz --qlevel 255 --clevel 1');
  expect(ktxArgs('bca', 4)[ktxArgs('bca', 4).indexOf('--format') + 1]).toBe('R8G8B8A8_SRGB');
});

test('data textures are ASSIGNED linear with unspecified primaries, never converted', () => {
  for (const cls of ['n', 'orm', 'orm_u', 'mask'] as const) {
    const a = ktxArgs(cls, cls === 'mask' ? 1 : 3).join(' ');
    expect(a).toContain('--assign-tf linear');
    expect(a).toContain('--assign-primaries none');
    expect(a).not.toContain('--convert-tf');
    expect(a).not.toContain('bt709');
  }
});

test('zstd only rides UASTC; RDO only on the explicit orm_u tier', () => {
  expect(ktxArgs('n', 3).join(' ')).toContain('--encode uastc --uastc-quality 4 --zstd 18');
  expect(ktxArgs('n', 3).join(' ')).not.toContain('--uastc-rdo');
  expect(ktxArgs('orm_u', 3).join(' ')).toContain('--uastc-rdo --uastc-rdo-l 4 --zstd 18');
  expect(ktxArgs('orm', 3).join(' ')).not.toContain('--zstd');
  expect(ktxArgs('mask', 1)[ktxArgs('mask', 1).indexOf('--format') + 1]).toBe('R8_UNORM');
});

test('plan and tier-1 pick agree in both directions, on multiple-of-four dims', () => {
  for (const p of TEXTURE_PLAN) {
    for (const d of p.dims) expect(d % 4).toBe(0);
    expect(p.dims).toContain(TIER1_PICK[p.key]);
  }
  // The reverse direction: a pick naming no plan entry would price 0 bytes into the tier-1 sum.
  const planned = TEXTURE_PLAN.map((p) => p.key);
  for (const k of Object.keys(TIER1_PICK)) expect(planned).toContain(k);
  expect(validateArgs('x.ktx2')).toEqual(['validate', '--warnings-as-errors', '--gltf-basisu', 'x.ktx2']);
});

test('every recipe generates a clamped, lanczos3 mip chain; the S2 defaults per class stand', () => {
  for (const recipe of ['etc1s', 'uastc', 'uastc_rdo', 'uastc_rdo4'] as const) {
    const args = ktxArgs('bc', 3, recipe).join(' ');
    expect(args).toContain('--generate-mipmap --mipmap-filter lanczos3 --mipmap-wrap clamp');
  }
  expect(ktxArgs('n', 3).join(' ')).toContain('--encode uastc --uastc-quality 4 --zstd 18');
  expect(ktxArgs('orm', 3, 'uastc_rdo4').join(' ')).toContain('--uastc-rdo --uastc-rdo-l 4');
  expect(ktxArgs('orm', 3, 'etc1s').join(' ')).not.toContain('--zstd');
});

test('the BC7 chain formula reproduces the measured uploads and the tier-1 VRAM line', () => {
  expect(bc7ChainBytes(1024)).toBe(1_398_128);
  expect(bc7ChainBytes(2048)).toBe(5_592_432);
  expect(bc7ChainBytes(4096)).toBe(22_369_648);
  expect(textureVramBytes(TIER1)).toBe(11_971_696);
});

test('tier 2 is the four founder swaps and every pick names a planned key', () => {
  expect(TIER2.map((p) => `${p.key}@${p.dim}:${p.recipe}`)).toEqual(['head_bc@2048:etc1s', 'clothes_bc@2048:etc1s', 'hair_bca@2048:etc1s', 'clothes_orm@1024:uastc_rdo4']);
  // The file names are a contract with the runtime swap table in src/scene/assets.ts: an upgraded
  // codec on a planned size carries the `u` suffix, and nothing else does.
  expect(TIER2.map(pickFile)).toEqual(['head_bc@2048.ktx2', 'clothes_bc@2048.ktx2', 'hair_bca@2048.ktx2', 'clothes_orm@1024u.ktx2']);
  const planned = new Set(TEXTURE_PLAN.map((p) => p.key));
  for (const pick of [...TIER1, ...TIER2]) expect(planned.has(pick.key)).toBe(true);
});
