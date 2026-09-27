import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cloneTuning } from '../packages/sim/src/config';
import { createRunExport } from '../packages/sim/src/export';
import { DEFAULT_TUNING } from '../packages/sim/src/tuning';
import type { SimConfig } from '../packages/sim/src/types';
import { playScript } from '../packages/sim/tests/helpers/bot';
import type { ScriptStep } from '../packages/sim/tests/helpers/bot';

const FIXTURES_DIR = fileURLToPath(
  new URL('../packages/sim/tests/golden/fixtures/', import.meta.url),
);

function baseConfig(overrides: Partial<SimConfig>): SimConfig {
  return {
    type: 'residential',
    mode: 'city',
    seed: 1,
    assist: false,
    tuning: cloneTuning(DEFAULT_TUNING),
    ...overrides,
  };
}

function repeat<T>(step: T, times: number): T[] {
  return Array.from({ length: times }, () => step);
}

function generate(name: string, config: SimConfig, script: readonly ScriptStep[]): void {
  const { sim } = playScript(config, script);
  const result = sim.getResult();
  if (result === null) {
    throw new Error(`gen-golden: fixture "${name}" did not reach a result`);
  }
  const exported = createRunExport(sim);
  writeFileSync(`${FIXTURES_DIR}${name}.json`, `${JSON.stringify(exported, null, 2)}\n`);
  console.log(`wrote ${name}.json (${result.result}, score ${String(result.score)})`);
}

export function main(): void {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  // 30 floors (Residential target) plus the automatic roof: >=8 consecutive Perfects, >=3 Goods
  // on each side, and 1 Miss along the way.
  generate('completed-residential', baseConfig({ type: 'residential', seed: 1001 }), [
    ...repeat<ScriptStep>('P', 8),
    'M',
    ...repeat<ScriptStep>('GL', 3),
    ...repeat<ScriptStep>('GR', 3),
    ...repeat<ScriptStep>('P', 16),
    'P', // the 31st drop: automatic roof at N = 30
  ]);

  // 20 floors, then an early Place Roof, a roof Miss, then a roof Good: result "built".
  generate('early-roof-commercial', baseConfig({ type: 'commercial', seed: 1002 }), [
    ...repeat<ScriptStep>('P', 20),
    'R',
    'M',
    'G',
  ]);

  // At least 10 floors, then 3 Misses: result "gameOver".
  generate('game-over-luxury', baseConfig({ type: 'luxury', seed: 1003 }), [
    ...repeat<ScriptStep>('P', 10),
    'M',
    'M',
    'M',
  ]);

  // Quick Play to >=25 floors, then 3 Misses, played with Steady Tower on.
  generate(
    'quick-play',
    baseConfig({ type: 'residential', mode: 'quick', assist: true, seed: 1004 }),
    [...repeat<ScriptStep>('P', 25), 'M', 'M', 'M'],
  );
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  main();
}
