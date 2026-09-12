// Run one Blender headless job with the flags that make failures visible, and hand back the
// job's sentinel line - `S<slice>_<JOB>_OK` (Blender's own banner and "Blender quit" also land
// on stdout, and every job prints its result line last).
import { spawn } from 'node:child_process';
import { PATHS } from './paths.ts';

export interface BlenderRun { sentinel: string | null; stdout: string }

export function runBlender(script: string, args: string[], opts: { blend?: string } = {}): Promise<BlenderRun> {
  const argv = ['-b', ...(opts.blend ? [opts.blend] : ['--factory-startup']), '--python-exit-code', '1', '--python', script, '--', ...args];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(PATHS.blender, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => { stdout += d; process.stdout.write(d); });
    child.stderr.on('data', (d: Buffer) => { stderr += d; process.stderr.write(d); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`blender exited ${code}\n${stderr.slice(-2000)}`));
      const sentinel = stdout.split(/\r?\n/).findLast((l) => /^S\d_/.test(l)) ?? null;
      resolvePromise({ sentinel, stdout });
    });
  });
}
