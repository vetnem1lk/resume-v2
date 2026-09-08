// KTX2 encode recipes per texture class (KTX-Software 4.4.2 `ktx create`) and the texture plan
// of the shipped look. Data maps are ASSIGNED linear (never converted) with unspecified
// primaries, the only combination KHR_texture_basisu accepts for linear data.
export type TexClass = 'bc' | 'bca' | 'n' | 'orm' | 'orm_u' | 'mask';

const FORMAT: Record<1 | 3 | 4, { srgb: string; unorm: string }> = {
  1: { srgb: 'R8_SRGB', unorm: 'R8_UNORM' },
  3: { srgb: 'R8G8B8_SRGB', unorm: 'R8G8B8_UNORM' },
  4: { srgb: 'R8G8B8A8_SRGB', unorm: 'R8G8B8A8_UNORM' },
};
const ETC1S = ['--encode', 'basis-lz', '--qlevel', '255', '--clevel', '1'];
const UASTC = ['--encode', 'uastc', '--uastc-quality', '4'];

export function ktxArgs(cls: TexClass, channels: 1 | 3 | 4): string[] {
  const f = FORMAT[channels];
  const linear = ['--assign-tf', 'linear', '--assign-primaries', 'none'];
  switch (cls) {
    case 'bc':
    case 'bca': return ['--format', f.srgb, '--assign-tf', 'srgb', '--assign-primaries', 'bt709', ...ETC1S, '--generate-mipmap'];
    case 'n': return ['--format', f.unorm, ...linear, ...UASTC, '--zstd', '18', '--generate-mipmap'];
    case 'orm_u': return ['--format', f.unorm, ...linear, ...UASTC, '--uastc-rdo', '--uastc-rdo-l', '4', '--zstd', '18', '--generate-mipmap'];
    case 'orm':
    case 'mask': return ['--format', f.unorm, ...linear, ...ETC1S, '--generate-mipmap'];
  }
}

export function validateArgs(file: string): string[] {
  return ['validate', '--warnings-as-errors', '--gltf-basisu', file];
}

export interface TexPlan { key: string; cls: TexClass; sources: string[]; dims: number[]; composite?: 'hair-rgba' | 'skin-orm' }

// Sources are UE package paths under /Game/IdaFaber/Textures (probe 2, material slots of the _03 look).
const B = '/Game/IdaFaber/Textures/Base/';
const T = '/Game/IdaFaber/Textures/';
export const TEXTURE_PLAN: TexPlan[] = [
  { key: 'head_bc', cls: 'bc', sources: [B + 'T_HEAD_F_BaseColor_06'], dims: [512, 1024, 2048] },
  { key: 'head_n', cls: 'n', sources: [B + 'T_HEAD_Normal_01'], dims: [512, 1024] },
  { key: 'head_orm', cls: 'orm', sources: [B + 'T_HEAD_F_Roughness'], dims: [512, 1024], composite: 'skin-orm' },
  { key: 'head_orm_u', cls: 'orm_u', sources: [B + 'T_HEAD_F_Roughness'], dims: [1024], composite: 'skin-orm' },
  { key: 'body_bc', cls: 'bc', sources: [B + 'T_BODY_F_BaseColor'], dims: [512, 1024] },
  { key: 'body_n', cls: 'n', sources: [B + 'T_BODY_Normal_02'], dims: [512, 1024] },
  { key: 'body_orm', cls: 'orm', sources: [B + 'T_BODY_Roughness'], dims: [512, 1024], composite: 'skin-orm' },
  { key: 'clothes_bc', cls: 'bc', sources: [T + 'T_MECHANICGIRL_CLOTHES_BaseColor_Orange'], dims: [1024, 2048] },
  { key: 'clothes_n', cls: 'n', sources: [T + 'T_MECHANICGIRL_CLOTHES_Normal'], dims: [512, 1024] },
  { key: 'clothes_orm', cls: 'orm', sources: [T + 'T_MECHANICGIRL_CLOTHES_OcclusionRoughnessMetallic'], dims: [512, 1024] },
  { key: 'shoes_bc', cls: 'bc', sources: [T + 'T_MECHANICGIRL_SHOES_BaseColor'], dims: [512, 1024] },
  { key: 'shoes_n', cls: 'n', sources: [T + 'T_MECHANICGIRL_SHOES_Normal'], dims: [512] },
  { key: 'shoes_orm', cls: 'orm', sources: [T + 'T_MECHANICGIRL_SHOES_OcclusionRoughnessMetallic'], dims: [512] },
  { key: 'hair_bca', cls: 'bca', sources: [B + 'Straight/T_HAIR_STRAIGHT_albedo', B + 'Straight/T_HAIR_STRAIGHT_alpha'], dims: [1024, 2048], composite: 'hair-rgba' },
  { key: 'hair_n', cls: 'n', sources: [B + 'Straight/T_HAIR_STRAIGHT_normal'], dims: [512, 1024] },
  { key: 'lashes_bca', cls: 'bca', sources: [B + 'T_LASHES_07'], dims: [512, 1024] },
  { key: 'eyes_bc', cls: 'bc', sources: [B + 'Mist/T_EYES_MIST_noAO_BaseColor_08'], dims: [512, 1024] },
  { key: 'cornea_bca', cls: 'bca', sources: [B + 'T_EYES_Cornea_01'], dims: [256, 512] },
];

// Tier 1 = the loader waits for it (spec section 4.8). Tier 2 adds head_bc@2048 as a sidecar.
export const TIER1_PICK: Record<string, number> = {
  head_bc: 1024, head_n: 512, head_orm: 512, head_orm_u: 1024,
  body_bc: 1024, body_n: 512, body_orm: 512,
  clothes_bc: 1024, clothes_n: 1024, clothes_orm: 1024,
  shoes_bc: 512, shoes_n: 512, shoes_orm: 512,
  hair_bca: 1024, hair_n: 512, lashes_bca: 512, eyes_bc: 512, cornea_bca: 256,
};
export const TIER1_EXCLUDE = new Set(['head_orm_u']);   // quality alternative, priced but not summed
