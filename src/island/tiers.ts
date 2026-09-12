// The desktop quality tier: KTX2 files fetched outside the GLB and swapped onto the live materials
// one per frame, driven from the island's frame callback - which paces the set and lets the island
// hold it back while the tab is off screen. A failed fetch skips its entry and is never retried.
import type { Material, Mesh, Object3D, Texture } from 'three';
import type { TierEntry } from '../scene/assets.ts';

type Slot = 'map' | 'aoMap' | 'roughnessMap' | 'metalnessMap';
/** One ORM file feeds three slots of the same material; they share one texture, not three. */
const SLOTS: Readonly<Record<TierEntry['slot'], readonly Slot[]>> = { map: ['map'], orm: ['aoMap', 'roughnessMap', 'metalnessMap'] };

/** Everything a loader-assigned texture and a standalone one share except the sampler state the
 *  glTF carried: a mismatch there makes the renderer allocate a second GL texture. */
export function adoptSampler(next: Texture, previous: Texture): void {
  next.wrapS = previous.wrapS;
  next.wrapT = previous.wrapT;
  next.channel = previous.channel;
  next.anisotropy = previous.anisotropy;
  next.offset.copy(previous.offset);
  next.repeat.copy(previous.repeat);
  next.center.copy(previous.center);
  next.rotation = previous.rotation;
  next.flipY = previous.flipY;
  next.colorSpace = previous.colorSpace;
  next.needsUpdate = true;
}

type Holder = Material & Partial<Record<Slot, Texture | null>>;

/** Swaps the slot(s) on every material of that name - the mirror twin carries the name too, and a
 *  texture left on it would be re-uploaded the frame after it was disposed. Returns the holders
 *  swapped; the old texture is shared across them, so it is disposed once, after the last of them
 *  points at the new one. No material.needsUpdate: the slot was occupied, the program key stands. */
export function swapMap(root: Object3D, materialName: string, slot: TierEntry['slot'], next: Texture): number {
  const seen = new Set<Material>();
  const replaced = new Set<Texture>();
  let hits = 0;
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material.name !== materialName || seen.has(material)) continue;
      seen.add(material);
      const holder = material as Holder;
      let swapped = false;
      for (const key of SLOTS[slot]) {
        const previous = holder[key];
        if (!previous) continue;                       // never add a slot at runtime: that needs a recompile
        if (!replaced.has(previous)) { adoptSampler(next, previous); replaced.add(previous); }
        holder[key] = next;
        swapped = true;
      }
      // The unlit twin of a lit material has no ORM slots: it matched the name but holds nothing.
      if (swapped) hits += 1;
    }
  });
  for (const previous of replaced) previous.dispose();
  return hits;
}

export interface TierPump {
  tick(): void;
  done(): boolean;
  /** Holders swapped, one number per adoption: how far the tier got, for the DEV readout. */
  holders(): readonly number[];
}

/** One adoption per tick, and the next fetch started in the same tick: the whole set never lands
 *  in one frame. A rejected load is dropped with its entry. */
export function createTierPump(root: Object3D, renderer: { initTexture(t: Texture): void }, entries: readonly TierEntry[], load: (url: string) => Promise<Texture>): TierPump {
  const queue = [...entries];
  const swapped: number[] = [];
  let inFlight: TierEntry | null = null;
  let ready: { entry: TierEntry; texture: Texture | null } | null = null;
  return {
    tick() {
      if (ready !== null) {
        const { entry, texture } = ready;
        ready = null;
        if (texture !== null) {
          const hits = swapMap(root, entry.material, entry.slot, texture);
          swapped.push(hits);
          // Nothing holds a texture no material wanted: it would be the only copy of itself.
          if (hits > 0) renderer.initTexture(texture); else texture.dispose();
        }
      }
      if (inFlight !== null || queue.length === 0) return;
      const entry = queue.shift()!;
      inFlight = entry;
      void load(entry.url).then((texture) => texture, () => null)   // a 404 skips the entry
        .then((texture) => { ready = { entry, texture }; inFlight = null; });
    },
    done: () => queue.length === 0 && inFlight === null && ready === null,
    holders: () => swapped,
  };
}
