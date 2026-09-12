// The byte stream against the pinned denominator, a 404 and an offline reload, with the fetch
// injected; and the loader stack constructing under Node (only detectSupport needs a renderer).
import { expect, test, vi } from 'vitest';
import { fetchWithProgress, loadCharacter } from '../src/island/loaders.ts';
import { GLB } from '../src/scene/assets.ts';

test('the bar counts against the pinned denominator, not Content-Length', async () => {
  const chunk = new Uint8Array(250_000);
  const body = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < 4; i += 1) c.enqueue(chunk); c.close(); } });
  const seen: number[] = [];
  // A brotli response declares the ENCODED length; the manifest's decoded total is the truth.
  const res = new Response(body, { headers: { 'content-length': '123', 'content-encoding': 'br' } });
  const buf = await fetchWithProgress('/g2/v2/x/mg.glb', 1_000_000, (p) => seen.push(p), vi.fn<typeof fetch>().mockResolvedValue(res));
  expect(seen).toEqual([25, 50, 75, 100]);
  expect(buf.byteLength).toBe(1_000_000);
});

test('a 404 throws with its status and reports no progress; offline rejects the same way', async () => {
  const seen: number[] = [];
  await expect(fetchWithProgress('/g2/v2/x/mg.glb', 10, (p) => seen.push(p), vi.fn<typeof fetch>().mockResolvedValue(new Response('nope', { status: 404 }))))
    .rejects.toThrow('/g2/v2/x/mg.glb: HTTP 404');
  await expect(fetchWithProgress('/g2/v2/x/mg.glb', 10, (p) => seen.push(p), vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))))
    .rejects.toThrow('Failed to fetch');
  expect(seen).toEqual([]);
});

test('a failed character load is dropped so the next mount retries; the URL is the pinned one', async () => {
  const doFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('nope', { status: 404 }));
  await expect(loadCharacter(() => {}, doFetch)).rejects.toThrow(`${GLB.url}: HTTP 404`);
  await expect(loadCharacter(() => {}, doFetch)).rejects.toThrow('HTTP 404');
  expect(doFetch).toHaveBeenCalledTimes(2);
});
