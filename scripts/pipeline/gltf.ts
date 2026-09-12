// Opens the gltf-transform packages that live inside the global CLI tree (the S2 recipe: they only
// resolve through absolute file URLs) and hands back the IO, the transforms, the extensions and
// the meshopt encoder. The vendored tree carries no resolvable types, so the shapes are declared.
export interface GltfTexture { setMimeType(m: string): GltfTexture; setImage(b: Uint8Array): GltfTexture; getImage(): Uint8Array | null; getName(): string }
export interface GltfExtensionProperty { setAnisotropyStrength(v: number): GltfExtensionProperty }
export interface GltfMaterial {
  getName(): string;
  setBaseColorFactor(v: [number, number, number, number]): GltfMaterial;
  setBaseColorTexture(t: GltfTexture): GltfMaterial;
  setNormalTexture(t: GltfTexture): GltfMaterial;
  setOcclusionTexture(t: GltfTexture): GltfMaterial;
  setMetallicRoughnessTexture(t: GltfTexture): GltfMaterial;
  setMetallicFactor(v: number): GltfMaterial;
  setRoughnessFactor(v: number): GltfMaterial;
  setAlphaMode(m: 'OPAQUE' | 'MASK' | 'BLEND'): GltfMaterial;
  setAlphaCutoff(v: number): GltfMaterial;
  setDoubleSided(v: boolean): GltfMaterial;
  setExtension(name: string, prop: GltfExtensionProperty): GltfMaterial;
}
export interface GltfExtension { setRequired(v: boolean): GltfExtension; createAnisotropy(): GltfExtensionProperty }
export interface GltfDocument {
  createExtension(ctor: unknown): GltfExtension;
  createTexture(name: string): GltfTexture;
  getRoot(): { listMaterials(): GltfMaterial[]; listTextures(): GltfTexture[]; listAnimations(): { getName(): string }[] };
  transform(...steps: unknown[]): Promise<void>;
}
export interface GltfIO { read(file: string): Promise<GltfDocument>; writeBinary(doc: GltfDocument): Promise<Uint8Array> }
type Transform = (...args: never[]) => unknown;

export async function openGltf(modulesDir: string): Promise<{ io: GltfIO; fn: Record<string, Transform>; ext: Record<string, unknown> & { ALL_EXTENSIONS: unknown[] }; encoder: unknown }> {
  const base = `file:///${modulesDir.replaceAll('\\', '/').replace(/\/?$/, '/')}`;
  const core = await import(`${base}@gltf-transform/core/dist/index.js`) as { NodeIO: new () => GltfIO & { registerExtensions(e: unknown[]): GltfIO & { registerDependencies(d: Record<string, unknown>): GltfIO } } };
  const ext = await import(`${base}@gltf-transform/extensions/dist/index.js`) as Record<string, unknown> & { ALL_EXTENSIONS: unknown[] };
  const fn = await import(`${base}@gltf-transform/functions/dist/index.js`) as Record<string, Transform>;
  const meshoptimizer = await import(`${base}meshoptimizer/index.js`) as { MeshoptDecoder: { ready: Promise<void> }; MeshoptEncoder: { ready: Promise<void> } };
  await meshoptimizer.MeshoptDecoder.ready;
  await meshoptimizer.MeshoptEncoder.ready;
  const io = new core.NodeIO().registerExtensions(ext.ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': meshoptimizer.MeshoptDecoder, 'meshopt.encoder': meshoptimizer.MeshoptEncoder });
  return { io, fn, ext, encoder: meshoptimizer.MeshoptEncoder };
}
