// The manifest: wire = the sidecar when it shrinks the file, else the file; never a sidecar beside
// an incompressible payload; totals add up; the hash is over the source bytes.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { brotli, manifest } from '../scripts/pipeline/manifest.ts';

test('a compressible file gets a sidecar and its wire size; an incompressible one keeps its bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
  const text = join(dir, 'a.json');
  writeFileSync(text, JSON.stringify({ rows: Array.from({ length: 200 }, (_, i) => ({ i, name: 'texture' })) }));
  const noise = join(dir, 'b.ktx2');
  writeFileSync(noise, Uint8Array.from({ length: 4096 }, (_, i) => (i * 7919) % 251));
  const m = manifest([{ file: text, path: 'a.json', compressible: true }, { file: noise, path: 'b.ktx2', compressible: false }], { blender: 'x', gltfTransform: 'y', ktx: 'z' }, 'build-1');
  expect(existsSync(`${text}.br`)).toBe(true);
  expect(existsSync(`${noise}.br`)).toBe(false);
  const [a, b] = m.files;
  expect(a?.br).toBe(true);
  expect(a?.wire).toBe(readFileSync(`${text}.br`).byteLength);
  expect(a?.wire).toBeLessThan(a!.disk);
  expect(b).toMatchObject({ br: false, wire: 4096, disk: 4096 });
  expect(m.total).toEqual({ disk: a!.disk + 4096, wire: a!.wire + 4096 });
  expect(brotli(readFileSync(text)).byteLength).toBe(a?.wire);
});
