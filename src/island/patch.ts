// One helper for every GLSL patch in the island: per-key slots composed in insertion order (the S6
// dissolve lands beside the floor fade on one material), one joined constant program key, and uniform
// objects owned here so every recompile binds the same ones. Applied AFTER any clone(), never before.
import type { Material, WebGLProgramParametersWithUniforms } from 'three';

export type Uniforms = Record<string, { value: unknown }>;

/** One slot. Hooks, measured on r185/r186: colour -> `map_fragment`; floor fade / dissolve glow ->
 *  `opaque_fragment`; dissolve discard -> `clipping_planes_fragment`; wrap-diffuse ->
 *  `lights_fragment_end`; vertex reads of `transformed` after `skinning_vertex`. */
export interface Patch {
  /** Constant; two patches with different GLSL must use different keys. */
  readonly key: string;
  /** Injected after `#include <common>` in the fragment shader (and the vertex shader when `vertex` is set). */
  readonly declarations?: string;
  /** `[chunk, glsl]` pairs appended after each `#include <chunk>` of the fragment shader. */
  readonly fragment?: readonly (readonly [string, string])[];
  readonly vertex?: readonly (readonly [string, string])[];
  readonly uniforms: Uniforms;
}

type Patched = Material & { userData: { patches?: Map<string, Patch> } };
type Lines = Map<string, string[]>;

const collect = (into: Lines, pairs: readonly (readonly [string, string])[] | undefined): void => {
  for (const [chunk, glsl] of pairs ?? []) into.set(chunk, [...(into.get(chunk) ?? []), glsl]);
};

/** Every chunk once, in slot order, so a later patch never lands ahead of an earlier one. */
function inject(source: string, declarations: string, lines: Lines): string {
  let out = declarations === '' ? source : source.replace('#include <common>', `#include <common>\n${declarations}`);
  for (const [chunk, glsl] of lines) {
    const include = `#include <${chunk}>`;
    if (!out.includes(include)) throw new Error(`patch: no ${include}`);
    const body = glsl.filter((g) => g !== '').join('\n');
    out = out.replace(include, body === '' ? include : `${include}\n${body}`);
  }
  return out;
}

/** Attaches `spec` to `material`; idempotent per key (a re-mount hands back the same cached materials).
 *  Three pins: three hands onBeforeCompile a FRESH uniform bag on every recompile, so the slot's own
 *  uniform objects are re-bound each time; customProgramCacheKey is appended to three's own key, so a
 *  constant key per patch keeps every material with the same patches on one program; Material.clone()
 *  copies neither hook and JSON-clones userData, so a clone is patched again, after the clone. */
export function patch(material: Material, spec: Patch): void {
  const target = material as Patched;
  const slots = (target.userData.patches ??= new Map<string, Patch>());
  if (slots.has(spec.key)) return;
  slots.set(spec.key, spec);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
    const fragment: Lines = new Map();
    const vertex: Lines = new Map();
    const fragmentDeclarations: string[] = [];
    const vertexDeclarations: string[] = [];
    for (const p of slots.values()) {
      Object.assign(shader.uniforms, p.uniforms);
      if (p.declarations) {
        fragmentDeclarations.push(p.declarations);
        if (p.vertex) vertexDeclarations.push(p.declarations);
      }
      collect(fragment, p.fragment);
      collect(vertex, p.vertex);
    }
    shader.fragmentShader = inject(shader.fragmentShader, fragmentDeclarations.join('\n'), fragment);
    shader.vertexShader = inject(shader.vertexShader, vertexDeclarations.join('\n'), vertex);
  };
  material.customProgramCacheKey = (): string => [...slots.keys()].join('|');
  material.needsUpdate = true;
}

/** The owned uniform objects of one slot, for per-frame writes. */
export function uniformsOf(material: Material, key: string): Uniforms | undefined {
  return (material as Patched).userData.patches?.get(key)?.uniforms;
}
