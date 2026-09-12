// The island's loader stack. One stack for the page's whole life: the KTX2 worker pool, the
// transcoder and the parsed GLB outlive every mount, because a disposed KTX2Loader never serves
// another texture and a second loader boots a second worker pool (measured).
import type { Texture, WebGLRenderer } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLB } from '../scene/assets.ts';
import { progressPct } from '../scene/loadstate.ts';

// The transcoder script and wasm are emitted by the build from the loader's own module URL, so
// no transcoder path is configured here.
export const ktx2 = new KTX2Loader().setWorkerLimit(2);
const gltf = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
let parsed: Promise<GLTF> | null = null;

/** Before the first texture load and again for every new renderer (the transcode target follows
 *  the renderer's extensions). init() is idempotent and starts the transcoder download now, beside
 *  the GLB, instead of when parseAsync reaches the first embedded image. */
export function detectSupport(renderer: WebGLRenderer): void {
  ktx2.detectSupport(renderer);
  void ktx2.init();
}

/** Streams the file and reports real received bytes against the pinned decoded length: the host
 *  answers from a brotli sidecar, so Content-Length is the encoded size. */
export async function fetchWithProgress(
  url: string,
  total: number,
  onProgress: (pct: number) => void,
  doFetch: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  const res = await doFetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  if (!res.body) {
    const whole = await res.arrayBuffer();
    onProgress(100);
    return whole;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    received += value.length;
    onProgress(progressPct(received, total));
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer;
}

/** Load (or re-use) the character. A failed load is dropped so the next mount retries. */
export function loadCharacter(onProgress: (pct: number) => void, doFetch: typeof fetch = fetch): Promise<GLTF> {
  if (parsed) {
    onProgress(100);
    return parsed;
  }
  const loading = fetchWithProgress(GLB.url, GLB.bytes, onProgress, doFetch)
    .then((buffer) => gltf.parseAsync(buffer, GLB.url.slice(0, GLB.url.lastIndexOf('/') + 1)));
  loading.catch(() => { parsed = null; });
  parsed = loading;
  return loading;
}

/** A tier-2 KTX2 fetched outside the GLB. Rides the same worker pool. */
export function loadTexture(url: string): Promise<Texture> {
  return ktx2.loadAsync(url);
}
