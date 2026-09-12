// The parsed character made ready for the island: the cut-outs coverage-tested, the idle action, the
// blink written through the morph dictionary, and the reduced-motion freeze in its only working order.
import { AnimationMixer, type AnimationAction, type Group, type Material, type Mesh } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

/** Mid-idle time for the reduced-motion freeze: a settled pose, never the bind pose. */
export const FREEZE_AT = 1.0;
/** One blink, eyes shut and open again; seconds on the loop clock. */
const BLINK_SECONDS = 0.18;
const BLINK_MORPHS = ['eyeBlinkLeft', 'eyeBlinkRight'] as const;

/** Triangle 0 -> 1 -> 0 across one blink; anything outside the window is eyes open. */
export function blinkValue(tSinceStart: number): number {
  if (tSinceStart <= 0 || tSinceStart >= BLINK_SECONDS) return 0;
  const half = BLINK_SECONDS / 2;
  return tSinceStart < half ? tSinceStart / half : (BLINK_SECONDS - tSinceStart) / half;
}

/** Maps a `Math.random()` draw onto the 2-6 s idle period between blinks. */
export function nextBlinkDelay(rand: number): number {
  return 2 + rand * 4;
}

/** Seek FIRST, pause SECOND: the other order freezes frame 0 (measured). */
export function freezeIdle(mixer: AnimationMixer, idle: AnimationAction, frozen: boolean): void {
  if (!frozen) { idle.paused = false; return; }
  mixer.setTime(FREEZE_AT);
  idle.paused = true;
}

export interface Character {
  readonly root: Group;
  readonly mixer: AnimationMixer;
  readonly idle: AnimationAction;
  readonly morphMeshes: readonly Mesh[];
  /** Advances the blink clock by `dt` seconds and writes the lids. */
  blink(dt: number): void;
  /** Reduced motion: the idle held at FREEZE_AT with the eyes open; false resumes it. */
  freeze(on: boolean): void;
}

const materialsOf = (mesh: Mesh): Material[] => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

/** Idempotent: a re-mount adopts the same cached graph, so every write here is a reset, not a step. */
export function adoptCharacter(gltf: GLTF): Character {
  const root = gltf.scene;
  // The export faces +Z; the spiral's angle 0 and the lights are laid out for a character facing -Z.
  root.rotation.y = Math.PI;
  const morphMeshes: Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    // Cut-outs (hair, lashes, cornea): coverage-tested, one pass, premultiplied like the canvas they land on.
    for (const material of materialsOf(mesh)) {
      if (material.alphaTest > 0) {
        material.alphaToCoverage = true;
        material.forceSinglePass = true;
        material.premultipliedAlpha = true;
      }
    }
    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
      mesh.morphTargetInfluences.fill(0);
      morphMeshes.push(mesh);
    }
  });
  const clip = gltf.animations.find((c) => c.name === 'Idle');
  if (clip === undefined) throw new Error('character: no Idle clip');
  const mixer = new AnimationMixer(root);
  const idle = mixer.clipAction(clip);
  idle.play();

  const writeLids = (v: number): void => {
    for (const mesh of morphMeshes) {
      for (const name of BLINK_MORPHS) {
        const index = mesh.morphTargetDictionary?.[name];
        const influences = mesh.morphTargetInfluences;
        if (index !== undefined && influences) influences[index] = v;
      }
    }
  };
  // The blink rides the loop's own clock, never a timer: a hidden tab freezes rAF and no blinks pile up.
  let clock = 0;
  let at = nextBlinkDelay(Math.random());
  let from = -1; // < 0 = eyes open
  return {
    root,
    mixer,
    idle,
    morphMeshes,
    blink(dt) {
      clock += dt;
      if (from >= 0) {
        // Always ride the ramp to its end, so the lids never stay half-closed.
        const t = clock - from;
        writeLids(blinkValue(t));
        if (t >= BLINK_SECONDS) from = -1;
      } else if (clock >= at) {
        at = clock + nextBlinkDelay(Math.random());
        from = clock;
      }
    },
    freeze(on) {
      freezeIdle(mixer, idle, on);
      if (on) {
        from = -1;
        writeLids(0);
      }
    },
  };
}
