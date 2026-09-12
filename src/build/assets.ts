// Serves the licensed runtime subset from OUTSIDE the repository in dev and preview, at its public
// path and with the host's immutable header and brotli sidecars, so the island is exercised against
// the real URLs; the build copies nothing (the subset is deployed on its own, D9 / D10).
import { createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import type { Plugin } from 'vite';

export const ASSET_PREFIX = '/g2/';

const TYPES: Readonly<Record<string, string>> = {
  '.glb': 'model/gltf-binary',
  '.ktx2': 'image/ktx2',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.png': 'image/png',
};

export interface Served {
  readonly file: string;
  readonly type: string;
}

/** Maps a request path under the prefix onto a file inside the root, or null when the path leaves
 *  the prefix, escapes the root, or names a type the host would not serve. */
export function resolveAsset(root: string, pathname: string): Served | null {
  if (!pathname.startsWith(ASSET_PREFIX)) return null;
  const base = resolve(root);
  const file = resolve(base, pathname.slice(ASSET_PREFIX.length));
  if (!file.startsWith(base + sep)) return null;
  const type = TYPES[file.slice(file.lastIndexOf('.'))];
  return type === undefined ? null : { file, type };
}

function send(root: string, req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const served = resolveAsset(root, new URL(req.url ?? '/', 'http://localhost').pathname);
  if (served === null) { next(); return; }
  const stat = statSync(served.file, { throwIfNoEntry: false });
  if (stat === undefined || !stat.isFile()) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', served.type);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  // The host serves a precompressed sidecar when the client accepts brotli; so does this.
  const sidecar = statSync(`${served.file}.br`, { throwIfNoEntry: false });
  const brotli = sidecar !== undefined && /\bbr\b/.test(String(req.headers['accept-encoding'] ?? ''));
  if (brotli) {
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Vary', 'Accept-Encoding');
  }
  const source = brotli ? `${served.file}.br` : served.file;
  res.setHeader('Content-Length', String((brotli ? sidecar : stat).size));
  if (req.method === 'HEAD') { res.end(); return; }
  // pipeline(), never pipe(): the deploy tree is regenerated under this server, so a read can
  // fail after the stat (EBUSY, ENOENT) - pipe() forwards no source error and an unhandled one
  // on a stream takes the process down. pipeline() destroys both ends; the head is already out.
  pipeline(createReadStream(source), res, () => undefined);
}

/** The deploy directory defaults to the pipeline's output beside the repository; ASSET_ROOT
 *  overrides it. Not registered for the build: the build never sees these bytes. */
export function assetHost(root = process.env.ASSET_ROOT ?? resolve(import.meta.dirname, '../../../raw_data/mg_build/s4/deploy/g2')): Plugin {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void): void => send(root, req, res, next);
  return {
    name: 'asset-host',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}
