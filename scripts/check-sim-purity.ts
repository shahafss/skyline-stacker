import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

export interface Violation {
  file: string;
  line: number;
  rule: string;
}

const FORBIDDEN_MATH_PROPERTIES = [
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
];

const FORBIDDEN_GLOBALS = [
  'Date',
  'performance',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  'requestAnimationFrame',
  'crypto',
  'window',
  'document',
  'globalThis',
  'process',
];

type MaskFrame = { kind: 'top' } | { kind: 'template' } | { kind: 'expr'; braceDepth: number };

/**
 * Replaces comments and the *contents* of string/template literals with spaces, keeping line
 * numbers, newlines and every other character (including `${...}` template expressions, scanned
 * as real code) intact. This is what keeps a `/` inside an import path or a `.` inside a version
 * string from being mistaken for a division operator or a non-integer literal.
 */
function maskNonCode(text: string): string {
  const out: string[] = [];
  let i = 0;
  const n = text.length;
  const stack: MaskFrame[] = [{ kind: 'top' }];

  const keep = (ch: string): void => {
    out.push(ch);
  };
  const mask = (ch: string): void => {
    out.push(ch === '\n' ? '\n' : ' ');
  };

  while (i < n) {
    const top = stack[stack.length - 1] ?? { kind: 'top' };
    const c = text[i] ?? '';
    const next = text[i + 1] ?? '';

    if (top.kind === 'template') {
      if (c === '\\') {
        mask(c);
        mask(next);
        i += 2;
        continue;
      }
      if (c === '`') {
        keep(c);
        stack.pop();
        i += 1;
        continue;
      }
      if (c === '$' && next === '{') {
        keep(c);
        keep(next);
        stack.push({ kind: 'expr', braceDepth: 0 });
        i += 2;
        continue;
      }
      mask(c);
      i += 1;
      continue;
    }

    if (c === '/' && next === '/') {
      // Comment delimiters are masked too: a leftover '/' here would look like division.
      mask(c);
      mask(next);
      i += 2;
      while (i < n && text[i] !== '\n') {
        mask(text[i] ?? '');
        i += 1;
      }
      continue;
    }
    if (c === '/' && next === '*') {
      mask(c);
      mask(next);
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        mask(text[i] ?? '');
        i += 1;
      }
      if (i < n) {
        mask(text[i] ?? '');
        mask(text[i + 1] ?? '');
        i += 2;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      keep(c);
      i += 1;
      while (i < n && text[i] !== quote) {
        if (text[i] === '\\') {
          mask(text[i] ?? '');
          mask(text[i + 1] ?? '');
          i += 2;
          continue;
        }
        mask(text[i] ?? '');
        i += 1;
      }
      if (i < n) {
        keep(text[i] ?? '');
        i += 1;
      }
      continue;
    }
    if (c === '`') {
      keep(c);
      i += 1;
      stack.push({ kind: 'template' });
      continue;
    }
    if (top.kind === 'expr') {
      if (c === '{') {
        top.braceDepth += 1;
        keep(c);
        i += 1;
        continue;
      }
      if (c === '}') {
        if (top.braceDepth === 0) {
          keep(c);
          stack.pop();
          i += 1;
          continue;
        }
        top.braceDepth -= 1;
        keep(c);
        i += 1;
        continue;
      }
    }
    keep(c);
    i += 1;
  }

  return out.join('');
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/** Scans stripped sim source text for every forbidden API and operator (research R4). */
export function scanSource(text: string, fileName: string): Violation[] {
  const violations: Violation[] = [];
  const code = maskNonCode(text);
  const isFixed = basename(fileName) === 'fixed.ts';

  for (const property of FORBIDDEN_MATH_PROPERTIES) {
    const re = new RegExp(`\\bMath\\.${property}\\b`, 'g');
    for (const match of code.matchAll(re)) {
      violations.push({
        file: fileName,
        line: lineOf(code, match.index),
        rule: `no-math-${property}`,
      });
    }
  }

  for (const name of FORBIDDEN_GLOBALS) {
    const re = new RegExp(`(?<![.\\w$])${name}\\b`, 'g');
    for (const match of code.matchAll(re)) {
      violations.push({
        file: fileName,
        line: lineOf(code, match.index),
        rule: `no-${name.toLowerCase()}`,
      });
    }
  }

  for (const match of code.matchAll(/\*\*=/g)) {
    violations.push({
      file: fileName,
      line: lineOf(code, match.index),
      rule: 'no-exponent-assign',
    });
  }
  for (const match of code.matchAll(/(?<!\*)\*\*(?!=|\*)/g)) {
    violations.push({
      file: fileName,
      line: lineOf(code, match.index),
      rule: 'no-exponent-operator',
    });
  }

  if (!isFixed) {
    for (const match of code.matchAll(/\/=/g)) {
      violations.push({
        file: fileName,
        line: lineOf(code, match.index),
        rule: 'no-division-assign',
      });
    }
    const withoutDivAssign = code.replaceAll('/=', '  ');
    for (const match of withoutDivAssign.matchAll(/\//g)) {
      violations.push({
        file: fileName,
        line: lineOf(code, match.index),
        rule: 'no-division-operator',
      });
    }
  }

  for (const match of code.matchAll(/(?<![.\w$])\d+\.\d+(?:[eE][+-]?\d+)?\b/g)) {
    violations.push({
      file: fileName,
      line: lineOf(code, match.index),
      rule: 'no-non-integer-literal',
    });
  }
  for (const match of code.matchAll(/(?<![.\w$])\d+[eE][+-]?\d+\b/g)) {
    violations.push({
      file: fileName,
      line: lineOf(code, match.index),
      rule: 'no-non-integer-literal',
    });
  }

  return violations;
}

/** Rejects any "dependencies" or "peerDependencies" field in packages/sim/package.json. */
export function checkSimPackageJson(json: Record<string, unknown>): Violation[] {
  const violations: Violation[] = [];
  if (json['dependencies'] !== undefined) {
    violations.push({
      file: 'packages/sim/package.json',
      line: 1,
      rule: 'no-runtime-dependencies',
    });
  }
  if (json['peerDependencies'] !== undefined) {
    violations.push({ file: 'packages/sim/package.json', line: 1, rule: 'no-peer-dependencies' });
  }
  return violations;
}

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (entry.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

export function main(): void {
  const srcDir = join(process.cwd(), 'packages/sim/src');
  const violations: Violation[] = [];

  for (const file of walk(srcDir)) {
    const text = readFileSync(file, 'utf8');
    violations.push(...scanSource(text, file));
  }

  const pkgPath = join(process.cwd(), 'packages/sim/package.json');
  const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
  violations.push(...checkSimPackageJson(pkgJson));

  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`${v.file}:${String(v.line)}: ${v.rule}`);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  main();
}
