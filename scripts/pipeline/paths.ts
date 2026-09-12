// Where the tools and the licensed asset data live. Everything is overridable through the
// environment so the repository carries no machine-specific path.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface PipelinePaths {
  blender: string;
  /** The engine install; its Templates tree is where the mannequin examples live. */
  ueEngine: string;
  ueCmd: string;
  ueProject: string | null;
  ktx: string;
  raw: string;
  build: string;
  gltfModules: string;
}

export function resolvePaths(env: NodeJS.ProcessEnv, repoRoot: string): PipelinePaths {
  const raw = env.MG_RAW ?? resolve(repoRoot, '..', 'raw_data');
  const appData = (env.APPDATA ?? resolve(repoRoot, '..')).replace(/\\/g, '/');
  return {
    blender: env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',
    ueEngine: env.UE_ENGINE ?? 'C:/Program Files/Epic Games/UE_5.8',
    ueCmd: env.UE_CMD ?? 'C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe',
    ueProject: env.UE_PROJECT ?? null,
    ktx: env.KTX ?? 'ktx',
    raw,
    build: env.MG_BUILD ?? resolve(raw, 'mg_build'),
    gltfModules: env.GLTF_MODULES ?? `${appData}/npm/node_modules/@gltf-transform/cli/node_modules/`,
  };
}

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const PATHS = resolvePaths(process.env, REPO_ROOT);

/** A tool that is not where the environment says is a configuration error, never a silent skip. */
export function requireTool(label: string, file: string, envVar: string): string {
  if (!existsSync(file)) throw new Error(`${label} not found at ${file}; set ${envVar}`);
  return file;
}
