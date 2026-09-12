// The entry's whole decision with the chunk import injected: the test hands it a rejecting loader,
// main.ts hands it the real import(). One attempt, never a retry: Chromium caches the failed
// module-map entry and Firefox re-requests on every call, so a retry is useless or a storm.
import { gateReason, WIDE, type GateEnv } from './gate.ts';

export interface IslandModule { mount(): void }
export type IslandLoader = () => Promise<IslandModule>;
export type BootResult = { readonly kind: 'island' } | { readonly kind: 'poster'; readonly reason: string };

/** Never rejects: a refused gate, a 404 chunk, an offline reload or a throwing mount leave the poster. */
export async function boot(env: GateEnv, load: IslandLoader): Promise<BootResult> {
  const reason = gateReason(env);
  if (reason !== null) return { kind: 'poster', reason };
  try {
    (await load()).mount();
    return { kind: 'island' };
  } catch (error) {
    return { kind: 'poster', reason: error instanceof Error ? `chunk: ${error.message}` : 'chunk' };
  }
}

/** The only impure line of the gate; every signal is optional on some browser. */
export function readEnv(win: Window): GateEnv {
  const nav = win.navigator as Navigator & { readonly connection?: { readonly saveData?: boolean } };
  return {
    wide: win.matchMedia(WIDE).matches,
    webgl2: 'WebGL2RenderingContext' in win,
    saveData: nav.connection?.saveData === true,
  };
}
