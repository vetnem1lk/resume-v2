// Run one UE 5.8 headless Python job. The editor's exit code is not a success signal (any
// logged Error flips it), so the job's own S2_RESULT line and the expected files decide.
import { spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { PATHS } from './paths.ts';

const MARK = 'S2_RESULT ';

export function runUe(script: string, logFile: string, expectFiles: string[]): Promise<Record<string, unknown>> {
  const project = PATHS.ueProject;
  if (!project) throw new Error('UE_PROJECT is not set (path to the .uproject that holds the pack)');
  const argv = [project, '-run=pythonscript', `-script=${script}`, '-unattended', '-nopause', '-nosplash', '-nop4', `-abslog=${logFile}`];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(PATHS.ueCmd, argv, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => {
      let log = '';
      try { log = readFileSync(logFile, 'utf8'); } catch { return reject(new Error(`no UE log at ${logFile} (exit ${code})`)); }
      const line = log.split(/\r?\n/).findLast((l) => l.includes(MARK));
      if (!line) return reject(new Error(`UE job wrote no ${MARK.trim()} (exit ${code}); tail:\n${log.slice(-3000)}`));
      let result: Record<string, unknown>;
      try { result = JSON.parse(line.slice(line.indexOf(MARK) + MARK.length)) as Record<string, unknown>; }
      catch { return reject(new Error(`UE job wrote an unparsable ${MARK.trim()} line: ${line.slice(-500)}`)); }
      for (const f of expectFiles) {
        let size = 0;
        try { size = statSync(f).size; } catch { size = 0; }
        if (size === 0) return reject(new Error(`UE job did not write ${f}`));
      }
      resolvePromise(result);
    });
  });
}
