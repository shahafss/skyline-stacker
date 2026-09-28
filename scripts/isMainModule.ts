import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * True when this module was invoked directly as the Node entry point (`tsx foo.ts ...`), as
 * opposed to being imported (for example, by a test). Compares realpaths rather than raw URLs so
 * that a path needing percent-encoding (spaces, etc.) or one reached through a symlink is still
 * recognized — the naive `import.meta.url === \`file://${process.argv[1]}\`` check silently
 * returns false in both cases, which disables the guarded `main()` call (and with it, whatever
 * CI gate depends on this script actually running).
 */
export function isMainModule(moduleUrl: string): boolean {
  const argv1 = process.argv[1];
  if (argv1 === undefined) return false;
  try {
    return fileURLToPath(moduleUrl) === realpathSync(argv1);
  } catch {
    return false;
  }
}
