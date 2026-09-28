import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Markers that must never reach a production bundle (FR-038): the dev-only tuning panel. */
const FORBIDDEN_STRINGS = ['skyline-tuning-panel', 'tuning-panel'];

const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.map', '.json']);

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

/** Returns one message per (file, forbidden string) match found under `distDir`. */
export function scanBundle(distDir: string): string[] {
  const violations: string[] = [];
  for (const file of walk(distDir)) {
    const dot = file.lastIndexOf('.');
    const ext = dot === -1 ? '' : file.slice(dot);
    if (!TEXT_EXTENSIONS.has(ext)) {
      continue;
    }
    const text = readFileSync(file, 'utf8');
    for (const needle of FORBIDDEN_STRINGS) {
      if (text.includes(needle)) {
        violations.push(`${file}: contains "${needle}"`);
      }
    }
  }
  return violations;
}

export function main(): void {
  const distDir = join(process.cwd(), 'apps/web/dist');
  const violations = scanBundle(distDir);

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation);
    }
    process.exit(1);
  }
  console.log('check:prod-bundle: no tuning-panel markers found in apps/web/dist.');
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  main();
}
