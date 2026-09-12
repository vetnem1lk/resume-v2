// The material table covers every material the export produces, every slot names a planned
// texture key, and the alpha / face rules match the design (cut-outs MASK, eyes OPAQUE).
import { expect, test } from 'vitest';
import { TEXTURE_PLAN, TIER1_PICK } from '../src/pipeline/ktx.ts';
import { EXPORTED_MATERIALS, LOOK } from '../src/pipeline/look.ts';

test('every exported material has a look and every look names planned tier-1 keys', () => {
  for (const name of EXPORTED_MATERIALS) expect(LOOK[name]).toBeDefined();
  const planned = new Set(TEXTURE_PLAN.map((p) => p.key));
  const keys = Object.values(LOOK).flatMap((look) => [look.base, look.normal, look.orm].filter((key): key is string => key !== undefined));
  for (const key of keys) {
    expect(planned.has(key)).toBe(true);
    expect(TIER1_PICK[key]).toBeGreaterThan(0);
  }
});

test('hair, lashes and the cornea are cut-outs, the eyes are opaque, skin is dielectric', () => {
  expect(LOOK.MAT_HAIR).toMatchObject({ alphaMode: 'MASK', cutoff: 0.5, doubleSided: true, anisotropy: 0.01 });
  expect(LOOK.MAT_LASHES?.alphaMode).toBe('MASK');
  expect(LOOK.MAT_CORNEA).toMatchObject({ alphaMode: 'MASK', doubleSided: false });
  expect(LOOK.MAT_EYE_L?.alphaMode).toBe('OPAQUE');
  expect(LOOK.MAT_HEAD).toMatchObject({ metallic: 0, doubleSided: false });
  expect(LOOK.MAT_CLOTHES?.metallic).toBe(1);
});
