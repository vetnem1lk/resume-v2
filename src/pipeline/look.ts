// The production look: which KTX2 key feeds which slot of which exported material, and the alpha,
// face and metal rules the FBX import gets wrong (it ships BLEND on hair, lashes and both eyes and
// double-sided everywhere). The look lives here, in reviewed data, not in Blender nodes.
export interface MaterialLook {
  readonly base: string;
  readonly normal?: string;
  /** One ORM texture feeds occlusion and metallicRoughness. */
  readonly orm?: string;
  readonly alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
  readonly cutoff?: number;
  readonly doubleSided: boolean;
  /** metallicFactor; 0 on skin neutralises the constant channel the synthesised ORM carries. */
  readonly metallic: number;
  /** KHR_materials_anisotropy strength seeded so the loader builds the physical material class. */
  readonly anisotropy?: number;
}

/** The nine material names the Blender export carries for the shipped look. */
export const EXPORTED_MATERIALS = ['MAT_HEAD', 'MAT_BODY', 'MAT_CLOTHES', 'MAT_SHOES', 'MAT_HAIR', 'MAT_LASHES', 'MAT_CORNEA', 'MAT_EYE_R', 'MAT_EYE_L'] as const;

export const LOOK: Readonly<Record<string, MaterialLook>> = {
  MAT_HEAD: { base: 'head_bc', normal: 'head_n', orm: 'head_orm', alphaMode: 'OPAQUE', doubleSided: false, metallic: 0 },
  MAT_BODY: { base: 'body_bc', normal: 'body_n', orm: 'body_orm', alphaMode: 'OPAQUE', doubleSided: false, metallic: 0 },
  MAT_CLOTHES: { base: 'clothes_bc', normal: 'clothes_n', orm: 'clothes_orm', alphaMode: 'OPAQUE', doubleSided: false, metallic: 1 },
  MAT_SHOES: { base: 'shoes_bc', normal: 'shoes_n', orm: 'shoes_orm', alphaMode: 'OPAQUE', doubleSided: false, metallic: 1 },
  MAT_HAIR: { base: 'hair_bca', normal: 'hair_n', alphaMode: 'MASK', cutoff: 0.5, doubleSided: true, metallic: 0, anisotropy: 0.01 },
  MAT_LASHES: { base: 'lashes_bca', alphaMode: 'MASK', cutoff: 0.5, doubleSided: true, metallic: 0 },
  MAT_CORNEA: { base: 'cornea_bca', alphaMode: 'MASK', cutoff: 0.5, doubleSided: false, metallic: 0 },
  MAT_EYE_R: { base: 'eyes_bc', alphaMode: 'OPAQUE', doubleSided: false, metallic: 0 },
  MAT_EYE_L: { base: 'eyes_bc', alphaMode: 'OPAQUE', doubleSided: false, metallic: 0 },
};
