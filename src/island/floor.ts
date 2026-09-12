// The mirrored floor: a detached-bind twin of every skinned mesh, sharing its skeleton, geometry and
// morph weights, reflected through y = floorY, unlit and faded with depth below the floor; plus the
// contact-shadow quad. Nothing here is lit, so the reflection reads as the paper's own.
import { CanvasTexture, type Color, DetachedBindMode, type Material, Mesh, MeshBasicMaterial, type Object3D, PlaneGeometry, SkinnedMesh, SRGBColorSpace, type Texture } from 'three';
import { patch, type Patch } from './patch.ts';

/** Metres under the floor at which the reflection has faded out completely (a taste call). */
const FADE_DEPTH = 0.6;
/** The contact shadow: quad side in metres, ink alpha at the centre (taste calls). */
const SHADOW_SIZE = 1.4;
const SHADOW_ALPHA = 0.35;
const INK = '20 22 26'; // --ink

export interface Floor {
  readonly twins: readonly SkinnedMesh[];
  readonly shadow: Mesh;
  dispose(): void;
}

/** One slot and one key for every twin, so they share a program (the cut-out twins get the ALPHATEST variant). */
const fadeSlot = (floorY: number): Patch => ({
  key: 'floor-fade',
  declarations: 'varying float vMirrorY; uniform float uFloorY; uniform float uFadeDepth;',
  vertex: [['skinning_vertex', 'vMirrorY = (modelMatrix * vec4(transformed, 1.0)).y;']],
  fragment: [['opaque_fragment', 'gl_FragColor.a *= 1.0 - smoothstep(0.0, uFadeDepth, uFloorY - vMirrorY);']],
  uniforms: { uFloorY: { value: floorY }, uFadeDepth: { value: FADE_DEPTH } },
});

type Mapped = Material & { map?: Texture | null; color?: Color };

/** A fresh unlit material carrying the source's name, colour, cut-out and facing rules, patched with
 *  the fade. The name is what the quality tier finds its holders by: the twin shares the source's
 *  texture, and one left behind would be re-uploaded the frame after the swap disposed it.
 *  Single pass: a transparent double-sided twin would otherwise be drawn twice (back faces, then front). */
function twinMaterial(source: Material, slot: Patch): MeshBasicMaterial {
  const { map, color, alphaTest, alphaToCoverage, side } = source as Mapped;
  const material = new MeshBasicMaterial({ map, color, alphaTest, alphaToCoverage, side, transparent: true, depthWrite: false, forceSinglePass: true });
  material.name = source.name;
  patch(material, slot);
  return material;
}

/** A radial ink gradient on a 2D canvas: darkest under the feet, transparent at the rim. */
function shadowTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgb(${INK} / ${SHADOW_ALPHA})`);
  gradient.addColorStop(1, `rgb(${INK} / 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Twins go on the scene root, never under the character: the reflection is their own transform. */
export function mirrorFloor(root: Object3D, floorY: number): Floor {
  const slot = fadeSlot(floorY);
  const twins: SkinnedMesh[] = [];
  root.traverse((object) => {
    const mesh = object as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    // One material per glTF primitive mesh: the loader splits multi-material meshes into siblings.
    const twin = new SkinnedMesh(mesh.geometry, twinMaterial(mesh.material as Material, slot));
    twin.bind(mesh.skeleton, mesh.bindMatrix);
    twin.bindMode = DetachedBindMode;
    twin.scale.y = -1;
    twin.position.y = 2 * floorY;
    twin.frustumCulled = false;
    // The same weights array, so the blink and every morph are mirrored for free.
    twin.morphTargetInfluences = mesh.morphTargetInfluences;
    twins.push(twin);
  });
  const texture = shadowTexture();
  const shadow = new Mesh(new PlaneGeometry(SHADOW_SIZE, SHADOW_SIZE), new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = floorY + 0.001;
  shadow.renderOrder = 1; // drawn over the reflection: the shadow lies on the floor's surface
  return {
    twins,
    shadow,
    dispose() {
      for (const twin of twins) (twin.material as Material).dispose();
      texture.dispose();
      shadow.geometry.dispose();
      (shadow.material as Material).dispose();
    },
  };
}
