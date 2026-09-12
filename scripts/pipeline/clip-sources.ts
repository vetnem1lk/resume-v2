// Provenance of every animation clip the pipeline knows: origin, licence, the route onto the
// character's skeleton, what the source reported, and whether the site ships it - the assemble step
// refuses a clip not registered as shipping. Licence TEXT lives outside the repository.
export type ClipLicence = 'engine-examples' | 'pack-licence' | 'free-pack' | 'mixamo' | 'founder-recording' | 'founder-authored';

export interface ClipMeasured {
  /** Intervals, as the engine counts frames. */
  readonly frames: number;
  /** Poses: frames + 1. */
  readonly keys: number;
  readonly fps: number;
  readonly rootMotion: boolean;
}

export interface ClipSource {
  /** The clip name inside the shipped GLB (three binds actions by it). */
  readonly id: string;
  /** The source asset's name at its origin. */
  readonly asset: string;
  /** The asset inside the project (/Game/...). */
  readonly assetPath: string;
  /** The skeleton the clip was authored on. */
  readonly skeleton: string;
  /** Where the asset came from, as a person would find it again. */
  readonly origin: string;
  readonly sourceFile?: string;
  readonly licence: ClipLicence;
  /** How the clip reaches the character's skeleton and the GLB. */
  readonly route: string;
  readonly ships: boolean;
  /** What the source reported; a re-export that disagrees is a build failure, not a silent swap. */
  readonly measured?: ClipMeasured;
  readonly seam?: 'trimmed-tail' | 'loop-seam-kept';
}

const PACK = 'the character pack (Demo/Animations/Girl)';
const PACK_ANIMS = '/Game/IdaFaber/Demo/Animations/Girl/';
const PACK_SKELETON = '/Game/IdaFaber/Meshes/Girl/SKEL_UE5_F';

export const CLIP_SOURCES: readonly ClipSource[] = [
  {
    id: 'Idle',
    asset: 'MM_Idle',
    assetPath: '/Game/Characters/Mannequins/Anims/Unarmed/MM_Idle',
    skeleton: '/Game/Characters/Mannequins/Meshes/SK_Mannequin',
    origin: 'Unreal Engine 5.8 install, Templates/TemplateResources/High/Characters/Content/Mannequins/Anims/Unarmed',
    sourceFile: 'MM_Unarmed_Idle_Ready.fbx',
    licence: 'engine-examples',
    route: 'copied into the project, the pack skeleton marked compatible, exported bones-only with the pack mesh pinned, rotation-only bake onto the look by bone name, seam kept',
    ships: true,
    measured: { frames: 227, keys: 228, fps: 30, rootMotion: false },
    seam: 'loop-seam-kept',
  },
  { id: 'PackIdle', asset: 'AS_UE5_MF_Idle', assetPath: `${PACK_ANIMS}AS_UE5_MF_Idle`, skeleton: PACK_SKELETON, origin: PACK, licence: 'pack-licence', route: 'measured in the inventory slice only', ships: false, measured: { frames: 130, keys: 131, fps: 30, rootMotion: true } },
  { id: 'Pose_01', asset: 'AS_Pose_F_01', assetPath: `${PACK_ANIMS}AS_Pose_F_01`, skeleton: PACK_SKELETON, origin: PACK, licence: 'pack-licence', route: 'measured in the inventory slice only', ships: false },
  { id: 'Pose_02', asset: 'AS_Pose_F_02', assetPath: `${PACK_ANIMS}AS_Pose_F_02`, skeleton: PACK_SKELETON, origin: PACK, licence: 'pack-licence', route: 'measured in the inventory slice only', ships: false },
  { id: 'Walk_Fwd', asset: 'AS_UE5_MF_Walk_Fwd', assetPath: `${PACK_ANIMS}AS_UE5_MF_Walk_Fwd`, skeleton: PACK_SKELETON, origin: PACK, licence: 'pack-licence', route: 'measured only; carries root motion', ships: false },
  { id: 'Run_Fwd', asset: 'AS_UE5_MF_Run_Fwd', assetPath: `${PACK_ANIMS}AS_UE5_MF_Run_Fwd`, skeleton: PACK_SKELETON, origin: PACK, licence: 'pack-licence', route: 'measured only; carries root motion', ships: false },
];

export function clipSource(id: string): ClipSource {
  const hit = CLIP_SOURCES.find((c) => c.id === id);
  if (hit === undefined) throw new Error(`clip ${id} is not registered in clip-sources.ts`);
  return hit;
}

/** The clips the assemble step may bake: every requested id must be registered AND shipping. */
export function shippingClips(ids: readonly string[]): ClipSource[] {
  return ids.map((id) => {
    const source = clipSource(id);
    if (!source.ships) throw new Error(`clip ${id} is registered but does not ship (${source.licence})`);
    return source;
  });
}
