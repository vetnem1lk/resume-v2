// The patch helper on a fake material: slots compose in order, keys join, a repeated key is a
// no-op, a missing chunk is an error, and every recompile gets the SAME uniform objects.
import { expect, test } from 'vitest';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';
import { patch, uniformsOf } from '../src/island/patch.ts';

type Hook = (shader: WebGLProgramParametersWithUniforms) => void;
const fakeMaterial = () => ({ userData: {}, needsUpdate: false, onBeforeCompile: undefined as Hook | undefined, customProgramCacheKey: undefined as (() => string) | undefined }) as unknown as Material & { onBeforeCompile: Hook; customProgramCacheKey: () => string };
const shader = () => ({ uniforms: {}, fragmentShader: '#include <common>\nvoid main() {\n#include <opaque_fragment>\n}', vertexShader: 'void main() {\n#include <skinning_vertex>\n}' }) as unknown as WebGLProgramParametersWithUniforms;

test('two patches compose in insertion order and join their keys', () => {
  const m = fakeMaterial();
  patch(m, { key: 'fade', declarations: 'uniform float uFade;', fragment: [['opaque_fragment', 'gl_FragColor.a *= uFade;']], uniforms: { uFade: { value: 0.5 } } });
  patch(m, { key: 'tint', fragment: [['opaque_fragment', 'gl_FragColor.rgb *= 0.9;']], uniforms: {} });
  const s = shader();
  m.onBeforeCompile(s);
  expect(s.fragmentShader).toBe('#include <common>\nuniform float uFade;\nvoid main() {\n#include <opaque_fragment>\ngl_FragColor.a *= uFade;\ngl_FragColor.rgb *= 0.9;\n}');
  expect(m.customProgramCacheKey()).toBe('fade|tint');
  expect(m.needsUpdate).toBe(true);
});

test('the same uniform objects are bound on every recompile, and a repeated key is a no-op', () => {
  const m = fakeMaterial();
  const uniforms = { uFade: { value: 1 } };
  patch(m, { key: 'fade', fragment: [['opaque_fragment', '']], uniforms });
  patch(m, { key: 'fade', fragment: [['opaque_fragment', 'never']], uniforms: { uFade: { value: 0 } } });
  const a = shader();
  const b = shader();
  m.onBeforeCompile(a);
  m.onBeforeCompile(b);
  expect(a.uniforms.uFade).toBe(uniforms.uFade);
  expect(b.uniforms.uFade).toBe(uniforms.uFade);
  expect(uniformsOf(m, 'fade')).toBe(uniforms);
  expect(a.fragmentShader).not.toContain('never');
});

test('a vertex pair lands after its chunk and a missing chunk throws', () => {
  const m = fakeMaterial();
  patch(m, { key: 'v', vertex: [['skinning_vertex', 'vY = transformed.y;']], uniforms: {} });
  const s = shader();
  m.onBeforeCompile(s);
  expect(s.vertexShader).toContain('#include <skinning_vertex>\nvY = transformed.y;');
  const bad = fakeMaterial();
  patch(bad, { key: 'x', fragment: [['no_such_chunk', '']], uniforms: {} });
  expect(() => bad.onBeforeCompile(shader())).toThrow('no #include <no_such_chunk>');
});

test('a JSON-cloned userData carries a plain object, not the slot map, and the clone still patches', () => {
  const m = fakeMaterial();
  patch(m, { key: 'fade', fragment: [['opaque_fragment', 'gl_FragColor.a *= 0.5;']], uniforms: { uFade: { value: 1 } } });
  const clone = fakeMaterial();
  clone.userData = JSON.parse(JSON.stringify(m.userData));   // exactly what Material.copy() does
  expect(clone.userData.patches).toEqual({});
  expect(uniformsOf(clone, 'fade')).toBeUndefined();
  patch(clone, { key: 'tint', fragment: [['opaque_fragment', 'gl_FragColor.rgb *= 0.9;']], uniforms: {} });
  const s = shader();
  clone.onBeforeCompile(s);
  expect(s.fragmentShader).toContain('#include <opaque_fragment>\ngl_FragColor.rgb *= 0.9;');
  expect(s.fragmentShader).not.toContain('gl_FragColor.a *= 0.5;');
  expect(clone.customProgramCacheKey()).toBe('tint');
});
