import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../packages/sim/src/config';
import { createRunExport } from '../../packages/sim/src/export';
import { createSim } from '../../packages/sim/src/sim';
import { DEFAULT_TUNING } from '../../packages/sim/src/tuning';
import { PHASE_SWINGING, RESULT_NONE } from '../../packages/sim/src/types';
import type { SimConfig } from '../../packages/sim/src/types';

const TSX_BIN = fileURLToPath(new URL('../../node_modules/.bin/tsx', import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL('../replay-run.ts', import.meta.url));
const FIXTURES_DIR = fileURLToPath(
  new URL('../../packages/sim/tests/golden/fixtures/', import.meta.url),
);

interface RunResult {
  readonly stdout: string;
  readonly status: number;
}

function runReplay(jsonPath: string): RunResult {
  try {
    const stdout = execFileSync(TSX_BIN, [SCRIPT_PATH, jsonPath], { encoding: 'utf8' });
    return { stdout, status: 0 };
  } catch (error) {
    const e = error as { stdout?: string; status?: number | null };
    return { stdout: e.stdout ?? '', status: e.status ?? 1 };
  }
}

function goldenFixtures(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(FIXTURES_DIR, f));
}

/** Builds a finished sim export with tuning modified away from the defaults. */
function overriddenExport(): unknown {
  const tuning = cloneTuning(DEFAULT_TUNING);
  tuning.global.LIVES = DEFAULT_TUNING.global.LIVES + 1;
  const config: SimConfig = {
    type: 'residential',
    mode: 'city',
    seed: 4242,
    assist: false,
    tuning,
  };
  const sim = createSim(config);
  const cap = 100_000;
  for (let i = 0; i < cap && sim.getState().result === RESULT_NONE; i += 1) {
    if (sim.getState().phase === PHASE_SWINGING) {
      sim.requestDrop();
    }
    sim.step();
  }
  return createRunExport(sim);
}

describe('scripts/replay-run.ts', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'replay-run-test-'));

  it('prints MATCH and exits 0 for every golden fixture', () => {
    for (const fixture of goldenFixtures()) {
      const { stdout, status } = runReplay(fixture);
      expect(stdout).toContain('MATCH');
      expect(stdout).not.toContain('MISMATCH');
      expect(status).toBe(0);
    }
  });

  it('prints MATCH and exits 0 for a generated overridden-tuning export', () => {
    const path = join(tmpDir, 'overridden.json');
    writeFileSync(path, JSON.stringify(overriddenExport()));

    const { stdout, status } = runReplay(path);
    expect(stdout).toContain('MATCH');
    expect(stdout).not.toContain('MISMATCH');
    expect(status).toBe(0);
  });

  it('prints MISMATCH and exits 1 when the hash is tampered with', () => {
    const fixture = goldenFixtures()[0];
    if (fixture === undefined) {
      throw new Error('no golden fixtures found');
    }
    const parsed = JSON.parse(readFileSync(fixture, 'utf8')) as { hash: number };
    parsed.hash = (parsed.hash + 1) >>> 0;
    const path = join(tmpDir, 'tampered.json');
    writeFileSync(path, JSON.stringify(parsed));

    const { stdout, status } = runReplay(path);
    expect(stdout).toContain('MISMATCH');
    expect(status).toBe(1);
  });
});
