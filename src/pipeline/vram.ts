// GPU bytes of three.js's morph-target texture (r185 WebGLMorphtargets): one RGBA32F
// DataArrayTexture per geometry, width = verts * slots, wrapped into rows at maxTextureSize.
// slots: 1 = POSITION only, 2 = +NORMAL, 3 = +COLOR (a cascade, not a sum).
export type Slots = 1 | 2 | 3;

export function naiveBytes(verts: number, slots: Slots, targets: number): number {
  return verts * slots * 16 * targets;
}

export function morphTextureBytes(verts: number, slots: Slots, targets: number, maxTextureSize = 16384): number {
  const w0 = verts * slots;
  const height = w0 > maxTextureSize ? Math.ceil(w0 / maxTextureSize) : 1;
  const width = w0 > maxTextureSize ? maxTextureSize : w0;
  return width * height * 4 * 4 * targets;
}

export interface VramRow { tier: string; targets: number; normalsOff: number; normalsOn: number; naiveOff: number }

export function vramTable(verts: number, tiers: Record<string, number>, maxTextureSize = 16384): VramRow[] {
  return Object.entries(tiers).map(([tier, targets]) => ({
    tier, targets,
    normalsOff: morphTextureBytes(verts, 1, targets, maxTextureSize),
    normalsOn: morphTextureBytes(verts, 2, targets, maxTextureSize),
    naiveOff: naiveBytes(verts, 1, targets),
  }));
}

export function MB(bytes: number): string {
  return `${(bytes / 1e6).toFixed(2)} MB`;
}
