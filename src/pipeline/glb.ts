// gltf-transform 4.4.2 accounting of a GLB: decoded bytes per mesh / morph / animation / texture
// (accessor sizes after meshopt decode) next to the on-disk size, and a markdown table of it.
export interface MeshRow { name: string; prims: number; verts: number; tris: number; targets: number; baseBytes: number; morphBytes: number }
export interface AnimRow { name: string; channels: number; keyframes: number; bytes: number; seconds: number }
export interface TexRow { name: string; mime: string; bytes: number }
export interface Accounting { meshes: MeshRow[]; animations: AnimRow[]; textures: TexRow[]; totals: { mesh: number; morph: number; anim: number; tex: number; other: number; decoded: number; disk: number } }

// The vendored packages only resolve through absolute file URLs (they live under the CLI's node_modules).
export async function openIO(modulesDir: string) {
  const base = `file:///${modulesDir.replace(/\\/g, '/').replace(/\/?$/, '/')}`;
  const { NodeIO } = await import(`${base}@gltf-transform/core/dist/index.js`);
  const { ALL_EXTENSIONS } = await import(`${base}@gltf-transform/extensions/dist/index.js`);
  const { MeshoptDecoder } = await import(`${base}meshoptimizer/index.js`);
  const fn = await import(`${base}@gltf-transform/functions/dist/index.js`);
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return { io, fn };
}

// eslint-style typing is intentionally loose: the vendored library has no local type declarations.
export function account(doc: any, disk: number, fn: any): Accounting {
  const root = doc.getRoot();
  const seen = new Set<object>();
  const uniq = (acc: any): number => { if (!acc || seen.has(acc)) return 0; seen.add(acc); return acc.getByteLength(); };
  const meshes: MeshRow[] = [];
  let mesh = 0, morph = 0;
  for (const m of root.listMeshes()) {
    let base = 0, mo = 0, targets = 0, tris = 0;
    for (const p of m.listPrimitives()) {
      for (const s of p.listSemantics()) base += uniq(p.getAttribute(s));
      base += uniq(p.getIndices());
      targets = Math.max(targets, p.listTargets().length);
      for (const t of p.listTargets()) for (const s of t.listSemantics()) mo += uniq(t.getAttribute(s));
      tris += fn.getGLPrimitiveCount(p);
    }
    mesh += base; morph += mo;
    meshes.push({ name: m.getName() || '(unnamed)', prims: m.listPrimitives().length, verts: fn.getMeshVertexCount(m, 'upload'), tris, targets, baseBytes: base, morphBytes: mo });
  }
  const animations: AnimRow[] = [];
  let anim = 0;
  for (const a of root.listAnimations()) {
    let b = 0, keys = 0, seconds = 0;
    for (const s of a.listSamplers()) {
      const input = s.getInput();
      keys = Math.max(keys, input?.getCount() ?? 0);
      seconds = Math.max(seconds, input?.getMax([0])?.[0] ?? 0);
      b += uniq(input) + uniq(s.getOutput());
    }
    anim += b;
    animations.push({ name: a.getName() || '(unnamed)', channels: a.listChannels().length, keyframes: keys, bytes: b, seconds });
  }
  const textures: TexRow[] = [];
  let tex = 0;
  for (const t of root.listTextures()) { const b = t.getImage()?.byteLength ?? 0; tex += b; textures.push({ name: t.getName() || '(unnamed)', mime: t.getMimeType(), bytes: b }); }
  const other = root.listAccessors().reduce((n: number, acc: any) => n + uniq(acc), 0);
  return { meshes, animations, textures, totals: { mesh, morph, anim, tex, other, decoded: mesh + morph + anim + other, disk } };
}

export function formatBudget(a: Accounting): string {
  const out = ['| mesh | prims | verts | tris | targets | base B | morph B |', '|---|---|---|---|---|---|---|'];
  for (const m of a.meshes) out.push(`| ${m.name} | ${m.prims} | ${m.verts} | ${m.tris} | ${m.targets} | ${m.baseBytes} | ${m.morphBytes} |`);
  out.push('', '| clip | channels | keyframes | bytes | s | B/s |', '|---|---|---|---|---|---|');
  for (const c of a.animations) out.push(`| ${c.name} | ${c.channels} | ${c.keyframes} | ${c.bytes} | ${c.seconds.toFixed(2)} | ${c.seconds > 0 ? Math.round(c.bytes / c.seconds) : 0} |`);
  const t = a.totals;
  out.push('', `decoded: mesh ${t.mesh} B, morph ${t.morph} B, anim ${t.anim} B, tex ${t.tex} B, other ${t.other} B = ${t.decoded} B; on disk ${t.disk} B`);
  return out.join('\n') + '\n';
}
