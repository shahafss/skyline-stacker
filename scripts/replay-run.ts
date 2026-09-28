import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { parseRunExport } from '../packages/sim/src/export';
import { replay } from '../packages/sim/src/replay';
import { isMainModule } from './isMainModule';

/** Resolves `path` against the directory the user ran the command from, when it is relative. */
function resolveInputPath(path: string): string {
  if (isAbsolute(path)) return path;
  const baseDir = process.env['INIT_CWD'] ?? process.cwd();
  return resolve(baseDir, path);
}

/**
 * Replays a run export from disk against a fresh sim built from **its own tuning** (FR-050), and
 * checks the replayed hash/result/score/floors against the ones recorded in the export. Lives
 * outside `packages/sim/src` (Node file I/O; the sim stays free of I/O, per Principle I).
 */
export function main(argv: readonly string[]): number {
  const rawPath = argv[0];
  if (rawPath === undefined) {
    console.error('usage: replay-run <run-export.json>');
    return 1;
  }

  const path = resolveInputPath(rawPath);

  let run: ReturnType<typeof parseRunExport>;
  let hash: number;
  let result: ReturnType<typeof replay>['result'];
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    run = parseRunExport(raw);
    ({ hash, result } = replay(run.config, run.inputLog));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`replay-run: ${message}`);
    return 1;
  }

  const matches =
    result !== null &&
    hash === run.hash &&
    result.result === run.result.result &&
    result.score === run.result.score &&
    result.floors === run.result.floors;

  console.log(`result: ${result === null ? 'none' : result.result}`);
  console.log(`score: ${String(result?.score ?? 0)}`);
  console.log(`floors: ${String(result?.floors ?? 0)}`);
  console.log(`hash: ${String(hash)}`);
  console.log(`tuningVersion: ${run.tuningVersion}`);
  console.log(`tuningOverridden: ${String(run.tuningOverridden)}`);
  console.log(matches ? 'MATCH' : 'MISMATCH');

  return matches ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
