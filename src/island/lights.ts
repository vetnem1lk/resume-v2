// The paper look (design D3): a RoomEnvironment PMREM for the reflections, a hemisphere fill in the
// paper's own colour, one warm key from the light strip's side and a cool rim from behind. No
// shadow map. Every chosen value sits in LIGHTS, overridable per mount for the taste round.
import { DirectionalLight, HemisphereLight, PMREMGenerator, type Scene, type Texture, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Vec3 } from '../scene/spiral.ts';

export interface Lights {
  /** `scene.environmentIntensity`, the one IBL knob. */
  readonly environment: number;
  /** PMREM cube size: 128 (Q9) or 256 for the look comparison. */
  readonly environmentSize: number;
  readonly hemisphere: number;
  readonly key: number;
  readonly rim: number;
  /** Hemisphere sky and ground colours. */
  readonly sky: number;
  readonly ground: number;
  readonly keyColor: number;
  readonly rimColor: number;
  /** Light directions as positions aimed at the origin (the character faces -Z). */
  readonly keyFrom: Vec3;
  readonly rimFrom: Vec3;
}

// The v1 proof lit with HemisphereLight(0xffffff, 0x888888, 0.6) and one white key 1.6 at (1, 2, 2)
// under environmentIntensity 1; these are the S4 starting values, judged against the first render.
export const LIGHTS: Lights = {
  environment: 0.9, // the brief's start; the reflection reads as paper, not as a showroom
  environmentSize: 128, // 1.57 MB of VRAM (P57); 256 quadruples it for a smoother reflection
  hemisphere: 0.5, // the brief's ~0.5: a paper fill that keeps the shadow side from going grey
  key: 1.2, // below the v1 1.6 so the cheek under NeutralToneMapping stays off white
  rim: 0.4, // low: a cool edge on the hair and shoulders, not a second key
  sky: 0xf4f1ea, // --paper
  ground: 0x6b5f52, // --dim warmed: the floor bounce is warm, not slate
  keyColor: 0xfffaf3, // the light strip's warm centre stop
  rimColor: 0xe9f5fa, // the light strip's cool stop
  keyFrom: [0.8, 2.6, -2.2], // above-front, a little off the strip's axis toward +X
  rimFrom: [-1.4, 1.9, 2.3], // behind, the opposite side
};

/** The PMREM of the room, generator freed at once; the render target's texture is the environment. */
export function buildEnvironment(renderer: WebGLRenderer, size: number = LIGHTS.environmentSize): Texture {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size }).texture;
  room.dispose();
  pmrem.dispose();
  return environment;
}

/** The three lights and the environment intensity; the environment texture itself is the renderer's. */
export function addLights(scene: Scene, lights: Lights = LIGHTS): void {
  scene.environmentIntensity = lights.environment;
  const key = new DirectionalLight(lights.keyColor, lights.key);
  key.position.set(...lights.keyFrom);
  const rim = new DirectionalLight(lights.rimColor, lights.rim);
  rim.position.set(...lights.rimFrom);
  scene.add(new HemisphereLight(lights.sky, lights.ground, lights.hemisphere), key, rim);
}
