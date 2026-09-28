import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** MVP initial download budget: 5 MB compressed (Principle VI). */
const MAX_BUNDLE_BYTES = 5 * 1024 * 1024; // 5,242,880 bytes

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

/** Sums the gzip-compressed size, in bytes, of every file under `distDir`. */
export function measureGzippedSize(distDir: string): number {
  let total = 0;
  for (const file of walk(distDir)) {
    const contents = readFileSync(file);
    total += gzipSync(contents).length;
  }
  return total;
}

export function main(): void {
  const distDir = join(process.cwd(), 'apps/web/dist');
  const totalBytes = measureGzippedSize(distDir);
  const mb = (totalBytes / (1024 * 1024)).toFixed(2);

  console.log(
    `check:bundle-size: apps/web/dist gzip total is ${String(totalBytes)} bytes (${mb} MB).`,
  );

  if (totalBytes > MAX_BUNDLE_BYTES) {
    console.error(
      `check:bundle-size: ${String(totalBytes)} bytes exceeds the ${String(MAX_BUNDLE_BYTES)} byte (5 MB) budget.`,
    );
    process.exit(1);
  }
}

function isMainModule(): boolean {
  const argv1 = process.argv[1];
  if (argv1 === undefined) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(argv1);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}
