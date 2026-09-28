import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isMainModule } from './isMainModule';

/** Markers that must never reach a production bundle (FR-038): the dev-only tuning panel. */
const FORBIDDEN_STRINGS = ['skyline-tuning-panel', 'tuning-panel'];

/**
 * Marker strings unique to the perf tools' own named exports (T090's `AutoBot`/`PerfCapture`),
 * as they appear in a chunk built with `VITE_PERF_TOOLS=1` (`export{f as AutoBot}` /
 * `export{a as PerfCapture}` once minified). A plain build tree-shakes both classes away
 * entirely, so neither string appears anywhere in `apps/web/dist/` (Constitution III).
 */
const FORBIDDEN_PERF_TOOL_STRINGS = ['as AutoBot', 'as PerfCapture'];

/** A chunk file emitted only for the perf tools themselves, e.g. `AutoBot-CneyxFOV.js`. */
const FORBIDDEN_CHUNK_NAME_PATTERNS = [/^AutoBot[-.]/, /^PerfCapture[-.]/];

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
    const name = basename(file);
    for (const pattern of FORBIDDEN_CHUNK_NAME_PATTERNS) {
      if (pattern.test(name)) {
        violations.push(`${file}: a perf-tools chunk file exists in a plain production build`);
      }
    }

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
    for (const needle of FORBIDDEN_PERF_TOOL_STRINGS) {
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
  console.log('check:prod-bundle: no tuning-panel or perf-tools markers found in apps/web/dist.');
}

if (isMainModule(import.meta.url)) {
  main();
}
