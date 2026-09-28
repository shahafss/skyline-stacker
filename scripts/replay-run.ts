import { readFileSync } from 'node:fs';
import { parseRunExport } from '../packages/sim/src/export';
import { replay } from '../packages/sim/src/replay';

/**
 * Replays a run export from disk against a fresh sim built from **its own tuning** (FR-050), and
 * checks the replayed hash/result/score/floors against the ones recorded in the export. Lives
 * outside `packages/sim/src` (Node file I/O; the sim stays free of I/O, per Principle I).
 */
export function main(argv: readonly string[]): number {
  const path = argv[0];
  if (path === undefined) {
    console.error('usage: replay-run <run-export.json>');
    return 1;
  }

  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const run = parseRunExport(raw);
  const { hash, result } = replay(run.config, run.inputLog);

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

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  process.exit(main(process.argv.slice(2)));
}
