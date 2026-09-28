import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSimPackageJson, scanSource } from '../check-sim-purity';

const TSX_BIN = fileURLToPath(new URL('../../node_modules/.bin/tsx', import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL('../check-sim-purity.ts', import.meta.url));
const IS_MAIN_MODULE_PATH = fileURLToPath(new URL('../isMainModule.ts', import.meta.url));

function rules(text: string, fileName = 'packages/sim/src/probe.ts'): string[] {
  return scanSource(text, fileName).map((v) => v.rule);
}

describe('scanSource', () => {
  it('flags every forbidden Math property', () => {
    for (const property of [
      'random',
      'sin',
      'cos',
      'tan',
      'atan2',
      'pow',
      'exp',
      'log',
      'sqrt',
      'asin',
      'acos',
      'atan',
      'cbrt',
      'hypot',
      'fround',
      'log2',
      'log10',
      'log1p',
      'expm1',
      'sinh',
      'cosh',
      'tanh',
    ]) {
      expect(rules(`const x = Math.${property}(1);`)).toContain(`no-math-${property}`);
    }
  });

  it('accepts allowed Math properties', () => {
    for (const call of [
      'Math.imul(1, 2)',
      'Math.trunc(1)',
      'Math.abs(-1)',
      'Math.min(1, 2)',
      'Math.max(1, 2)',
      'Math.sign(-1)',
    ]) {
      expect(rules(`const x = ${call};`)).toEqual([]);
    }
  });

  it('flags forbidden globals', () => {
    expect(rules('const x = Date.now();')).toContain('no-date');
    expect(rules('const x = performance.now();')).toContain('no-performance');
    expect(rules('setTimeout(() => {}, 0);')).toContain('no-settimeout');
    expect(rules('setInterval(() => {}, 0);')).toContain('no-setinterval');
    expect(rules('setImmediate(() => {});')).toContain('no-setimmediate');
    expect(rules('queueMicrotask(() => {});')).toContain('no-queuemicrotask');
    expect(rules('requestAnimationFrame(() => {});')).toContain('no-requestanimationframe');
    expect(rules('const x = crypto.getRandomValues;')).toContain('no-crypto');
    expect(rules('const x = window.innerWidth;')).toContain('no-window');
    expect(rules('const x = document.body;')).toContain('no-document');
    expect(rules('const x = globalThis;')).toContain('no-globalthis');
    expect(rules('const x = process.env;')).toContain('no-process');
  });

  it('flags the exponent operator and its assignment form', () => {
    expect(rules('const x = 2 ** 3;')).toContain('no-exponent-operator');
    expect(rules('let x = 2; x **= 3;')).toContain('no-exponent-assign');
  });

  it('flags division and division-assignment outside fixed.ts', () => {
    expect(rules('const x = a / b;')).toContain('no-division-operator');
    expect(rules('let x = 4; x /= 2;')).toContain('no-division-assign');
  });

  it('does not flag a slash inside a relative import path', () => {
    expect(rules("import { div } from './fixed';")).toEqual([]);
    expect(rules("import { div } from '../fixed';")).toEqual([]);
  });

  it('does not flag a period inside a version string', () => {
    expect(rules("export const SIM_VERSION = '0.1.0';")).toEqual([]);
  });

  it('does not flag digits and periods inside a template literal', () => {
    expect(rules('const msg = `value must be 0.5 or /`;')).toEqual([]);
  });

  it('still flags a real division inside a template expression', () => {
    expect(rules('const msg = `${a / b}`;')).toContain('no-division-operator');
  });

  it('does not flag the delimiters of a backtick-quoted JSDoc comment as division', () => {
    expect(rules('/** `releaseTick + DROP_FALL_TICKS`. */\nconst x = 1;')).toEqual([]);
  });

  it("does not flag a line comment's own slashes as division", () => {
    expect(rules('// see a/b in the PRD\nconst x = 1;')).toEqual([]);
  });

  it('allows division only in fixed.ts', () => {
    expect(rules('const x = a / b;', 'packages/sim/src/fixed.ts')).toEqual([]);
  });

  it('flags non-integer numeric literals', () => {
    expect(rules('const x = 0.5;')).toContain('no-non-integer-literal');
    expect(rules('const x = 1e10;')).toContain('no-non-integer-literal');
  });

  it('flags a forbidden call hidden behind an eslint-disable comment', () => {
    const text = ['// eslint-disable-next-line no-restricted-properties', 'Math.random();'].join(
      '\n',
    );
    expect(rules(text)).toContain('no-math-random');
  });

  it('reports the correct line number', () => {
    const text = ['const a = 1;', 'const b = Math.random();'].join('\n');
    const violations = scanSource(text, 'packages/sim/src/probe.ts');
    expect(violations[0]?.line).toBe(2);
  });
});

describe('checkSimPackageJson', () => {
  it('rejects a package.json with dependencies', () => {
    const violations = checkSimPackageJson({ dependencies: { x: '1' } });
    expect(violations.map((v) => v.rule)).toContain('no-runtime-dependencies');
  });

  it('rejects a package.json with peerDependencies', () => {
    const violations = checkSimPackageJson({ peerDependencies: { x: '1' } });
    expect(violations.map((v) => v.rule)).toContain('no-peer-dependencies');
  });

  it('accepts a package.json with neither', () => {
    expect(checkSimPackageJson({ name: '@skyline/sim' })).toEqual([]);
  });
});

describe('scripts/check-sim-purity.ts main() CLI', () => {
  const spaceDirs: string[] = [];

  afterEach(() => {
    for (const dir of spaceDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('still fails (exit 1, reporting the violation) when run through a path containing a space', () => {
    // A naive `import.meta.url === \`file://${process.argv[1]}\`` check silently returns false
    // for a path needing percent-encoding, which disables the `main()` call entirely: the CLI
    // would print nothing and exit 0 even with a forbidden API present. Reproduces that path
    // shape and asserts the gate still fires (T104).
    const spaceDir = mkdtempSync(join(tmpdir(), 'check sim purity '));
    spaceDirs.push(spaceDir);

    const scriptCopy = join(spaceDir, 'check-sim-purity.ts');
    copyFileSync(SCRIPT_PATH, scriptCopy);
    copyFileSync(IS_MAIN_MODULE_PATH, join(spaceDir, 'isMainModule.ts'));

    const simSrcDir = join(spaceDir, 'packages/sim/src');
    mkdirSync(simSrcDir, { recursive: true });
    writeFileSync(join(simSrcDir, 'probe.ts'), 'export const x = Math.random();\n');
    writeFileSync(join(spaceDir, 'packages/sim/package.json'), '{"name":"@skyline/sim"}\n');

    function run(): { readonly stdout: string; readonly stderr: string; readonly status: number } {
      try {
        const stdout = execFileSync(TSX_BIN, [scriptCopy], { encoding: 'utf8', cwd: spaceDir });
        return { stdout, stderr: '', status: 0 };
      } catch (error) {
        const e = error as { stdout?: string; stderr?: string; status?: number | null };
        return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', status: e.status ?? 1 };
      }
    }

    const { stdout, stderr, status } = run();
    expect(status).toBe(1);
    expect(stdout + stderr).toContain('no-math-random');
  });
});
