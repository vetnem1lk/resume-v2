// Tool and data locations are environment-driven; defaults must be sane and overrides must win.
import { expect, test } from 'vitest';
import { resolvePaths } from '../scripts/pipeline/paths.ts';

const repo = 'C:/work/site';

test('defaults derive from the repository root and standard installs', () => {
  const p = resolvePaths({ APPDATA: 'C:/Users/me/AppData/Roaming' }, repo);
  expect(p.raw.replace(/\\/g, '/')).toBe('C:/work/raw_data');
  expect(p.build.replace(/\\/g, '/')).toBe('C:/work/raw_data/mg_build');
  expect(p.blender).toContain('Blender 5.2');
  expect(p.ueCmd).toContain('UnrealEditor-Cmd.exe');
  expect(p.ueProject).toBeNull();
  expect(p.ktx).toBe('ktx');
  expect(p.gltfModules).toBe('C:/Users/me/AppData/Roaming/npm/node_modules/@gltf-transform/cli/node_modules/');
});

test('environment overrides win', () => {
  const p = resolvePaths(
    { MG_RAW: 'D:/raw', BLENDER: 'D:/b/blender.exe', UE_CMD: 'D:/ue/cmd.exe', UE_PROJECT: 'D:/p/x.uproject', KTX: 'D:/k/ktx.exe', GLTF_MODULES: 'D:/gt/' },
    repo,
  );
  expect(p.raw).toBe('D:/raw');
  expect(p.blender).toBe('D:/b/blender.exe');
  expect(p.ueCmd).toBe('D:/ue/cmd.exe');
  expect(p.ueProject).toBe('D:/p/x.uproject');
  expect(p.ktx).toBe('D:/k/ktx.exe');
  expect(p.gltfModules).toBe('D:/gt/');
  expect(resolvePaths({ UE_ENGINE: 'X:/UE' }, repo).ueEngine).toBe('X:/UE');
});
