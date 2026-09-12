// Copies the two engine template assets the idle needs into the project, keeping their package
// name (/Game/Characters/...) and their file path in agreement. Never overwrites: a second run is
// a no-op and the project stays the founder's.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const TEMPLATE_FILES = ['Anims/Unarmed/MM_Idle.uasset', 'Meshes/SK_Mannequin.uasset'] as const;

export function copyMannequinTemplate(engineRoot: string, projectDir: string): string[] {
  const from = resolve(engineRoot, 'Templates/TemplateResources/High/Characters/Content/Mannequins');
  const to = resolve(projectDir, 'Content/Characters/Mannequins');
  const copied: string[] = [];
  for (const rel of TEMPLATE_FILES) {
    const src = resolve(from, rel);
    const dst = resolve(to, rel);
    if (!existsSync(src)) throw new Error(`engine template file missing: ${src}`);
    if (existsSync(dst)) continue;
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst);
    copied.push(dst);
  }
  return copied;
}
