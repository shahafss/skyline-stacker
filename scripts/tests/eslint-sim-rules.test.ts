import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

async function lint(code: string, filePath: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? '');
}

const PROBE_PATH = 'packages/sim/src/__probe__.ts';

describe('eslint sim-scoped rules', () => {
  it('flags Math.random()', async () => {
    const messages = await lint('Math.random();\n', PROBE_PATH);
    expect(messages).toContain('no-restricted-properties');
  });

  it('flags Date.now()', async () => {
    const messages = await lint('Date.now();\n', PROBE_PATH);
    expect(messages).toContain('no-restricted-globals');
  });

  it('flags 2 ** 3', async () => {
    const messages = await lint('const x = 2 ** 3;\n', PROBE_PATH);
    expect(messages).toContain('no-restricted-syntax');
  });

  it('flags a / b', async () => {
    const messages = await lint('const a = 1; const b = 2; const c = a / b;\n', PROBE_PATH);
    expect(messages).toContain('no-restricted-syntax');
  });

  it('flags the literal 0.5', async () => {
    const messages = await lint('const x = 0.5;\n', PROBE_PATH);
    expect(messages).toContain('no-restricted-syntax');
  });

  it('flags a non-relative import', async () => {
    const messages = await lint("import x from 'lodash';\n", PROBE_PATH);
    expect(messages).toContain('no-restricted-imports');
  });

  it('allows a / b in fixed.ts', async () => {
    const messages = await lint(
      'const a = 1; const b = 2; const c = a / b;\n',
      'packages/sim/src/fixed.ts',
    );
    expect(messages).not.toContain('no-restricted-syntax');
  });
});
