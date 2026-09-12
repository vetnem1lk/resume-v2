// The loader's progress denominator and the served byte counts: one row per file, bytes on disk and
// over the wire. Brotli quality 10 at a 16 MB window measured smaller AND twice as fast as quality 11
// at the default window on the GLB; a sidecar is written only where it shrinks the file, since a
// `precompressed br` host would otherwise serve the larger one beside an incompressible KTX2.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { brotliCompressSync, constants } from 'node:zlib';

export interface ManifestRow { path: string; disk: number; wire: number; br: boolean; sha256: string }
export interface Manifest { built: string; tool: { blender: string; gltfTransform: string; ktx: string }; files: ManifestRow[]; total: { disk: number; wire: number } }

export function brotli(buf: Uint8Array): Buffer {
  return brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 10, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: buf.byteLength } });
}

export function manifest(files: readonly { file: string; path: string; compressible: boolean }[], tool: Manifest['tool'], built: string): Manifest {
  const rows: ManifestRow[] = [];
  for (const entry of files) {
    const buf = readFileSync(entry.file);
    let wire = buf.byteLength;
    if (entry.compressible) {
      const compressed = brotli(buf);
      if (compressed.byteLength < buf.byteLength) {
        writeFileSync(`${entry.file}.br`, compressed);
        wire = compressed.byteLength;
      }
    }
    rows.push({ path: entry.path, disk: buf.byteLength, wire, br: wire < buf.byteLength, sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16) });
  }
  return { built, tool, files: rows, total: rows.reduce((acc, row) => ({ disk: acc.disk + row.disk, wire: acc.wire + row.wire }), { disk: 0, wire: 0 }) };
}
