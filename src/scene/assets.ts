// The served runtime subset by its public, versioned path, and the byte counts the loader's
// progress bar counts against. The counts are DECODED lengths measured on the served artifact by
// the assemble step (which prints this block); a brotli response's Content-Length is the encoded
// length and never the denominator. Licensed content: never in the repository (D10).

/** One immutable directory per build of the subset. */
export const ASSET_BASE = '/g2/v2/s4a/';

export const GLB = {
  url: `${ASSET_BASE}mg.glb`,
  bytes: 3_977_536,
} as const;

/** The poster column the character stands in (CSS px at 1x); the files are 1x and 2x, AVIF + WebP. */
export const POSTER = {
  dir: `${ASSET_BASE}poster/`,
  width: 460,
  height: 1300,
} as const;

export interface TierEntry {
  /** The exported material name (three keeps it on `material.name`). */
  readonly material: string;
  readonly slot: 'map' | 'orm';
  readonly url: string;
}

/** The desktop quality tier (Q6): swapped in one texture per frame once the scene is live. */
export const TIER2: readonly TierEntry[] = [
  { material: 'MAT_HEAD', slot: 'map', url: `${ASSET_BASE}tex/head_bc@2048.ktx2` },
  { material: 'MAT_CLOTHES', slot: 'map', url: `${ASSET_BASE}tex/clothes_bc@2048.ktx2` },
  { material: 'MAT_HAIR', slot: 'map', url: `${ASSET_BASE}tex/hair_bca@2048.ktx2` },
  { material: 'MAT_CLOTHES', slot: 'orm', url: `${ASSET_BASE}tex/clothes_orm@1024u.ktx2` },
];
