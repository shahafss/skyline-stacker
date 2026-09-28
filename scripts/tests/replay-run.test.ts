import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { cloneTuning } from '../../packages/sim/src/config';
import { createRunExport } from '../../packages/sim/src/export';
import { replay } from '../../packages/sim/src/replay';
import { createSim } from '../../packages/sim/src/sim';
import { DEFAULT_TUNING, TUNING_VERSION } from '../../packages/sim/src/tuning';
import { PHASE_SWINGING, RESULT_NONE } from '../../packages/sim/src/types';
import type { SimConfig } from '../../packages/sim/src/types';

const TSX_BIN = fileURLToPath(new URL('../../node_modules/.bin/tsx', import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL('../replay-run.ts', import.meta.url));
const IS_MAIN_MODULE_PATH = fileURLToPath(new URL('../isMainModule.ts', import.meta.url));
const PACKAGES_DIR = fileURLToPath(new URL('../../packages/', import.meta.url));
const FIXTURES_DIR = fileURLToPath(
  new URL('../../packages/sim/tests/golden/fixtures/', import.meta.url),
);

interface RunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
}

function runReplay(
  args: readonly string[],
  options?: { readonly env?: NodeJS.ProcessEnv },
): RunResult {
  try {
    const stdout = execFileSync(TSX_BIN, [SCRIPT_PATH, ...args], {
      encoding: 'utf8',
      env: options?.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; status?: number | null };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', status: e.status ?? 1 };
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
  tuning.types.residential.cranePeriodTicks = DEFAULT_TUNING.types.residential.cranePeriodTicks + 7;
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
  const extraDirs: string[] = [];

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    for (const dir of extraDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prints MATCH and exits 0 for every golden fixture', () => {
    for (const fixture of goldenFixtures()) {
      const { stdout, status } = runReplay([fixture]);
      expect(stdout).toContain('MATCH');
      expect(stdout).not.toContain('MISMATCH');
      expect(status).toBe(0);
    }
  });

  it('replays a generated overridden-tuning export using its own tuning, not the defaults', () => {
    const runExport = overriddenExport() as {
      config: SimConfig;
      inputLog: readonly { tick: number; type: 'drop' | 'roof' }[];
      hash: number;
    };
    const path = join(tmpDir, 'overridden.json');
    writeFileSync(path, JSON.stringify(runExport));

    const { stdout, status } = runReplay([path]);
    expect(stdout).toContain('tuningOverridden: true');
    expect(stdout).toContain('MATCH');
    expect(stdout).not.toContain('MISMATCH');
    expect(status).toBe(0);

    // Replaying the same input log against the *default* tuning must give a different hash,
    // proving the CLI actually used the export's own (overridden) tuning rather than defaults.
    const defaultConfig: SimConfig = { ...runExport.config, tuning: cloneTuning(DEFAULT_TUNING) };
    const { hash: defaultHash } = replay(defaultConfig, runExport.inputLog);
    expect(defaultHash).not.toBe(runExport.hash);
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

    const { stdout, status } = runReplay([path]);
    expect(stdout).toContain('MISMATCH');
    expect(status).toBe(1);
  });

  it('still replays with MATCH and exit code 0 when tuningVersion differs from current', () => {
    const fixture = goldenFixtures()[0];
    if (fixture === undefined) {
      throw new Error('no golden fixtures found');
    }
    const parsed = JSON.parse(readFileSync(fixture, 'utf8')) as { tuningVersion: string };
    expect(parsed.tuningVersion).toBe(TUNING_VERSION);
    parsed.tuningVersion = '0.0.0-stale';
    const path = join(tmpDir, 'stale-tuning-version.json');
    writeFileSync(path, JSON.stringify(parsed));

    const { stdout, status } = runReplay([path]);
    expect(stdout).toContain('MATCH');
    expect(stdout).not.toContain('MISMATCH');
    expect(status).toBe(0);
  });

  it('runs main when invoked through a path that needs percent-encoding (a space)', () => {
    // Built entirely under os.tmpdir(), never inside the repo. The copy's relative imports
    // ('../packages/sim/...', './isMainModule') need `packages/` and `isMainModule.ts` to sit
    // next to it the same way they do relative to the real scripts/replay-run.ts, so a `packages`
    // symlink is linked in one directory up and isMainModule.ts is copied alongside the script.
    const parentDir = mkdtempSync(join(tmpdir(), 'replay-run-space-test-'));
    extraDirs.push(parentDir);
    symlinkSync(PACKAGES_DIR, join(parentDir, 'packages'));

    const spaceDir = mkdtempSync(join(parentDir, 'replay run '));
    const scriptCopy = join(spaceDir, 'replay-run.ts');
    copyFileSync(SCRIPT_PATH, scriptCopy);
    copyFileSync(IS_MAIN_MODULE_PATH, join(spaceDir, 'isMainModule.ts'));

    const fixture = goldenFixtures()[0];
    if (fixture === undefined) {
      throw new Error('no golden fixtures found');
    }

    const stdout = execFileSync(TSX_BIN, [scriptCopy, fixture], { encoding: 'utf8' });
    expect(stdout).toContain('MATCH');
    expect(stdout).not.toContain('MISMATCH');
  });

  it('runs main when invoked through a symlinked path', () => {
    // isMainModule() compares realpathSync(argv[1]) against the module's own resolved URL; this
    // guards against silently returning false (and disabling main()) when the entry point is
    // reached through a symlink rather than a direct path (T099/T104).
    const parentDir = mkdtempSync(join(tmpdir(), 'replay-run-symlink-test-'));
    extraDirs.push(parentDir);
    const symlinkPath = join(parentDir, 'replay-run-link.ts');
    symlinkSync(SCRIPT_PATH, symlinkPath);

    const fixture = goldenFixtures()[0];
    if (fixture === undefined) {
      throw new Error('no golden fixtures found');
    }

    const stdout = execFileSync(TSX_BIN, [symlinkPath, fixture], { encoding: 'utf8' });
    expect(stdout).toContain('MATCH');
    expect(stdout).not.toContain('MISMATCH');
  });

  it('reports a missing file as a one-line error with exit code 1', () => {
    const path = join(tmpDir, 'does-not-exist.json');
    const { stdout, stderr, status } = runReplay([path]);
    expect(status).toBe(1);
    expect(stdout).toBe('');
    const lines = stderr.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^replay-run: \S/);
    expect(stderr).toContain('ENOENT');
    expect(stderr).not.toContain('    at ');
  });

  it('reports malformed JSON as a one-line error with exit code 1', () => {
    const path = join(tmpDir, 'malformed.json');
    writeFileSync(path, '{ not valid json');
    const { stdout, stderr, status } = runReplay([path]);
    expect(status).toBe(1);
    expect(stdout).toBe('');
    const lines = stderr.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^replay-run: \S/);
    expect(stderr).toContain('JSON');
    expect(stderr).not.toContain('    at ');
  });

  it('reports a ReplayError (invalid export) as a one-line error with exit code 1', () => {
    const runExport = overriddenExport() as { inputLog: { tick: number; type: string }[] };
    // Break strictly-increasing tick ordering so replay() throws a ReplayError.
    runExport.inputLog = [
      { tick: 5, type: 'drop' },
      { tick: 3, type: 'drop' },
    ];
    const path = join(tmpDir, 'invalid-replay.json');
    writeFileSync(path, JSON.stringify(runExport));

    const { stdout, stderr, status } = runReplay([path]);
    expect(status).toBe(1);
    expect(stdout).toBe('');
    const lines = stderr.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('replay-run: input log ticks must be strictly increasing');
    expect(stderr).not.toContain('    at ');
  });

  it('resolves a relative path against INIT_CWD, not process.cwd()', () => {
    const { stdout, status } = runReplay(['completed-residential.json'], {
      env: { ...process.env, INIT_CWD: FIXTURES_DIR },
    });
    expect(stdout).toContain('MATCH');
    expect(stdout).not.toContain('MISMATCH');
    expect(status).toBe(0);
  });
});
