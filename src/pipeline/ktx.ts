// KTX2 encode recipes per texture class (KTX-Software 4.4.2 `ktx create`) and the texture plan
// of the shipped look. Data maps are ASSIGNED linear (never converted) with unspecified
// primaries, the only combination KHR_texture_basisu accepts for linear data.
export type TexClass = 'bc' | 'bca' | 'n' | 'orm' | 'orm_u' | 'mask';

const FORMAT: Record<1 | 3 | 4, { srgb: string; unorm: string }> = {
  1: { srgb: 'R8_SRGB', unorm: 'R8_UNORM' },
  3: { srgb: 'R8G8B8_SRGB', unorm: 'R8G8B8_UNORM' },
  4: { srgb: 'R8G8B8A8_SRGB', unorm: 'R8G8B8A8_UNORM' },
};
export type Recipe = 'etc1s' | 'uastc' | 'uastc_rdo' | 'uastc_rdo4';

const SRGB = ['--assign-tf', 'srgb', '--assign-primaries', 'bt709'];
const LINEAR = ['--assign-tf', 'linear', '--assign-primaries', 'none'];
// `--zstd` is rejected beside basis-lz; the RDO lambdas are the two the matrix measured (0.5 on
// normals, 4 on an ORM: clothes_orm 30.2 -> 37.7 dB for +0.5 MB).
const ENCODE: Readonly<Record<Recipe, readonly string[]>> = {
  etc1s: ['--encode', 'basis-lz', '--qlevel', '255', '--clevel', '1'],
  uastc: ['--encode', 'uastc', '--uastc-quality', '4', '--zstd', '18'],
  uastc_rdo: ['--encode', 'uastc', '--uastc-quality', '4', '--uastc-rdo', '--uastc-rdo-l', '0.5', '--zstd', '18'],
  uastc_rdo4: ['--encode', 'uastc', '--uastc-quality', '4', '--uastc-rdo', '--uastc-rdo-l', '4', '--zstd', '18'],
};
const DEFAULT_RECIPE: Readonly<Record<TexClass, Recipe>> = { bc: 'etc1s', bca: 'etc1s', n: 'uastc', orm: 'etc1s', orm_u: 'uastc_rdo4', mask: 'etc1s' };
// The binary's default mip wrap is WRAP (the help text says clamp): every S2 chain bled the atlas
// edge into its small mips. One resampler end to end: sharp resizes with lanczos3, so do the mips.
const MIPS = ['--generate-mipmap', '--mipmap-filter', 'lanczos3', '--mipmap-wrap', 'clamp'];

export function ktxArgs(cls: TexClass, channels: 1 | 3 | 4, recipe: Recipe = DEFAULT_RECIPE[cls]): string[] {
  const colour = cls === 'bc' || cls === 'bca';
  return ['--format', colour ? FORMAT[channels].srgb : FORMAT[channels].unorm, ...(colour ? SRGB : LINEAR), ...ENCODE[recipe], ...MIPS];
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

// The size per key the loader waits for (spec section 4.8); TIER1 below turns it into picks.
export const TIER1_PICK: Record<string, number> = {
  head_bc: 1024, head_n: 512, head_orm: 512, head_orm_u: 1024,
  body_bc: 1024, body_n: 512, body_orm: 512,
  clothes_bc: 1024, clothes_n: 1024, clothes_orm: 1024,
  shoes_bc: 512, shoes_n: 512, shoes_orm: 512,
  hair_bca: 1024, hair_n: 512, lashes_bca: 512, eyes_bc: 512, cornea_bca: 256,
};
export const TIER1_EXCLUDE = new Set(['head_orm_u']);   // quality alternative, priced but not summed

const classOf = (key: string): TexClass => {
  const plan = TEXTURE_PLAN.find((p) => p.key === key);
  if (plan === undefined) throw new Error(`no texture plan for ${key}`);
  return plan.cls;
};

export interface TexPick { readonly key: string; readonly dim: number; readonly recipe: Recipe }

/** Tier 1 = the loader waits for it: the S2 pick minus the priced-only alternative, re-encoded
 *  with the corrected mip flags. */
export const TIER1: readonly TexPick[] = Object.entries(TIER1_PICK)
  .filter(([key]) => !TIER1_EXCLUDE.has(key))
  .map(([key, dim]) => ({ key, dim, recipe: DEFAULT_RECIPE[classOf(key)] }));

/** Tier 2 = the desktop quality set (founder Q6): 2K colour on the three maps that fill the frame,
 *  and the one measurably wrong codec fixed. Normals stay where S2 put them. */
export const TIER2: readonly TexPick[] = [
  { key: 'head_bc', dim: 2048, recipe: 'etc1s' },
  { key: 'clothes_bc', dim: 2048, recipe: 'etc1s' },
  { key: 'hair_bca', dim: 2048, recipe: 'etc1s' },
  { key: 'clothes_orm', dim: 1024, recipe: 'uastc_rdo4' },
];

/** `<key>@<dim>.ktx2` for the class's default recipe, `<key>@<dim>u.ktx2` for an upgraded codec
 *  on the same key and size, so the two never collide in one directory. */
export function pickFile(pick: TexPick): string {
  return `${pick.key}@${pick.dim}${pick.recipe === DEFAULT_RECIPE[classOf(pick.key)] ? '' : 'u'}.ktx2`;
}

/** GPU bytes of one BC7 mip chain: every level pads to whole 4x4 blocks of 16 B and never costs
 *  less than one block. Both ETC1S and UASTC transcode to BC7 on a desktop GPU. */
export function bc7ChainBytes(dim: number): number {
  let bytes = 0;
  for (let d = dim; d >= 1; d = Math.floor(d / 2)) bytes += Math.max(16, Math.ceil(d / 4) ** 2 * 16);
  return bytes;
}

export function textureVramBytes(picks: readonly TexPick[]): number {
  return picks.reduce((n, p) => n + bc7ChainBytes(p.dim), 0);
}

export interface ManifestTexture { key: string; dim: number; recipe: Recipe; file: string; bytes: number; gpuBytes: number }

export function manifestRow(pick: TexPick, file: string, bytes: number): ManifestTexture {
  return { key: pick.key, dim: pick.dim, recipe: pick.recipe, file, bytes, gpuBytes: bc7ChainBytes(pick.dim) };
}
