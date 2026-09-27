import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRunExport } from '../../src/export';
import { replay } from '../../src/replay';
import { DEFAULT_TUNING, TUNING_VERSION } from '../../src/tuning';

const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url));

function loadFixtures(): { name: string; raw: unknown }[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((name) => ({
      name,
      raw: JSON.parse(readFileSync(`${FIXTURES_DIR}${name}`, 'utf8')) as unknown,
    }));
}

describe('golden fixtures (SC-007, Node)', () => {
  const fixtures = loadFixtures();

  it('has at least one fixture', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures.map((f) => [f.name, f.raw] as const))(
    '%s: parses, uses default tuning, and replays to its recorded result and hash',
    (_name, raw) => {
      const fixture = parseRunExport(raw);
      expect(fixture.tuningOverridden).toBe(false);
      expect(fixture.tuningVersion).toBe(TUNING_VERSION);
      expect(fixture.config.tuning).toEqual(DEFAULT_TUNING);

      const replayed = replay(fixture.config, fixture.inputLog);
      expect(replayed.result).toEqual(fixture.result);
      expect(replayed.hash).toBe(fixture.hash);
    },
  );

  it('includes at least one each of completed, built and gameOver', () => {
    const results = fixtures.map((f) => parseRunExport(f.raw).result.result);
    expect(results).toContain('completed');
    expect(results).toContain('built');
    expect(results).toContain('gameOver');
  });

  it('replaying completed-residential 1000 times gives one hash', () => {
    const fixture = fixtures.find((f) => f.name === 'completed-residential.json');
    expect(fixture).toBeDefined();
    const parsed = parseRunExport(fixture?.raw);
    const hashes = new Set<number>();
    for (let i = 0; i < 1000; i += 1) {
      hashes.add(replay(parsed.config, parsed.inputLog).hash);
    }
    expect(hashes.size).toBe(1);
    expect(hashes.has(parsed.hash)).toBe(true);
  });
});
