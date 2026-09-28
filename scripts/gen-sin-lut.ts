import { writeFileSync } from 'node:fs';
import { isMainModule } from './isMainModule';

const SIZE = 4096;

function fnv1a(bytes: readonly number[]): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function computeSinLut(): number[] {
  const table: number[] = [];
  for (let k = 0; k < SIZE; k += 1) {
    table.push(Math.round(32767 * Math.sin((2 * Math.PI * k) / SIZE)));
  }
  return table;
}

export function checksumOf(table: readonly number[]): number {
  const bytes: number[] = [];
  for (const v of table) {
    const u16 = v & 0xffff;
    bytes.push(u16 & 0xff, (u16 >>> 8) & 0xff);
  }
  return fnv1a(bytes);
}

function render(table: readonly number[], checksum: number): string {
  const rows: string[] = [];
  for (let i = 0; i < table.length; i += 16) {
    rows.push(`  ${table.slice(i, i + 16).join(', ')},`);
  }
  return `// GENERATED — do not edit. Run \`pnpm gen:sin-lut\` to regenerate.
// SIN_LUT[k] = round(32767 * sin(2*pi*k/4096)) for k = 0..4095 (data-model §1.3, PRD §5.2).

/** Q15 sine lookup table, 4096 entries in [-32767, 32767]. Index with \`phase >>> 20\`. */
export const SIN_LUT: readonly number[] = Object.freeze([
${rows.join('\n')}
]);

/** FNV-1a 32-bit checksum of \`SIN_LUT\`, each entry as a 16-bit little-endian two's complement value. */
export const SIN_LUT_CHECKSUM = ${String(checksum)};
`;
}

export function main(): void {
  const table = computeSinLut();
  const checksum = checksumOf(table);
  const outPath = new URL('../packages/sim/src/sinLut.ts', import.meta.url);
  writeFileSync(outPath, render(table, checksum));
}

if (isMainModule(import.meta.url)) {
  main();
}
