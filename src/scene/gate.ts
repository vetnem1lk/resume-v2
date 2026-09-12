// Whether this page gets the scene island at all: a pure decision over an environment snapshot,
// so the entry stays a few bytes and the rule is tested under Node. Reduced motion is not a gate
// (the scene mounts frozen, D8); a narrow viewport is (the stage is a poster band there).

/** The breakpoint where doc.css makes the stage a fixed full-viewport layer. */
export const WIDE = '(min-width: 1024px)';

export type GateReason = 'narrow' | 'no-webgl2' | 'save-data';

export interface GateEnv {
  /** matchMedia(WIDE).matches - never innerWidth: a classic scrollbar puts clientWidth below the breakpoint at 1024-1039 px. */
  readonly wide: boolean;
  /** 'WebGL2RenderingContext' in the window; the real context probe runs inside the island. */
  readonly webgl2: boolean;
  /** navigator.connection.saveData, Chromium only; false everywhere else. */
  readonly saveData: boolean;
}

/** null = mount; otherwise the first reason the poster stays, in the order a reader would give. */
export function gateReason(env: GateEnv): GateReason | null {
  if (!env.wide) return 'narrow';
  if (!env.webgl2) return 'no-webgl2';
  if (env.saveData) return 'save-data';
  return null;
}
