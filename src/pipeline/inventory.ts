// Reads the Blender inventory JSON (one entry per FBX file) into rows, module-set totals and a
// per-morph ranking: the numbers the design spec quotes come from here, nowhere else.
export interface ShapeKeyRow { name: string; max_delta_m: number; mean_delta_m: number; moved_verts: number; relative_key: string | null; mute: boolean }
export interface MeshEntry {
  verts: number; edges: number; loops: number; polys: number; eval_tris: number; eval_verts: number;
  uv_layers: string[]; color_attributes: [string, string, string][]; material_slots: string[];
  modifiers: [string, string][]; bound_bones: string[]; shape_keys: ShapeKeyRow[];
  images: [string, string, boolean, string][];
}
export interface InventoryFile {
  file: string; import_s: number;
  armature: { bone_count: number; deform_count: number; bones: [string, string | null, boolean][] } | null;
  meshes: Record<string, MeshEntry>;
}
export interface ObjectRow { file: string; object: string; verts: number; tris: number; morphs: number; bones: number; uv: string; colors: number; materials: string }
export interface ModuleSet { file: string; objects: ObjectRow[]; verts: number; tris: number; boundBones: string[] }
export interface MorphRank { name: string; maxDeltaMm: number; meanDeltaMm: number; movedVerts: number }

export function rows(inv: InventoryFile[]): ObjectRow[] {
  return inv.flatMap((f) =>
    Object.entries(f.meshes).map(([object, m]) => ({
      file: f.file, object, verts: m.verts, tris: m.eval_tris, morphs: m.shape_keys.length, bones: m.bound_bones.length,
      uv: m.uv_layers.join('+'), colors: m.color_attributes.length, materials: m.material_slots.join('+'),
    })),
  );
}

export function moduleSet(inv: InventoryFile[], file: string): ModuleSet {
  const entry = inv.find((f) => f.file === file);
  if (!entry) throw new Error(`inventory has no file ${file}`);
  const objects = rows(inv).filter((r) => r.file === file);
  const bones = new Set<string>();
  for (const m of Object.values(entry.meshes)) for (const b of m.bound_bones) bones.add(b);
  return {
    file, objects,
    verts: objects.reduce((n, r) => n + r.verts, 0),
    tris: objects.reduce((n, r) => n + r.tris, 0),
    boundBones: [...bones].toSorted(),
  };
}

export function morphRanking(inv: InventoryFile[], file: string, mesh: string): MorphRank[] {
  const m = inv.find((f) => f.file === file)?.meshes[mesh];
  if (!m) throw new Error(`inventory has no mesh ${mesh} in ${file}`);
  return m.shape_keys
    .map((k) => ({ name: k.name, maxDeltaMm: k.max_delta_m * 1000, meanDeltaMm: k.mean_delta_m * 1000, movedVerts: k.moved_verts }))
    .toSorted((a, b) => b.maxDeltaMm - a.maxDeltaMm);
}

export function toMarkdown(s: { set: ModuleSet; rows: ObjectRow[]; ranking: MorphRank[] }): string {
  const out = [`## Module set ${s.set.file}: ${s.set.verts} verts, ${s.set.tris} tris, ${s.set.boundBones.length} bound bones`, '',
    '| object | verts | tris | morphs | bound bones | uv | colour attrs | materials |', '|---|---|---|---|---|---|---|---|'];
  for (const r of s.rows) out.push(`| ${r.object} | ${r.verts} | ${r.tris} | ${r.morphs} | ${r.bones} | ${r.uv} | ${r.colors} | ${r.materials} |`);
  out.push('', '## Morph ranking (head, max delta mm)', '', '| # | morph | max mm | mean mm | moved verts |', '|---|---|---|---|---|');
  s.ranking.forEach((m, i) => out.push(`| ${i + 1} | ${m.name} | ${m.maxDeltaMm.toFixed(2)} | ${m.meanDeltaMm.toFixed(3)} | ${m.movedVerts} |`));
  return out.join('\n') + '\n';
}
