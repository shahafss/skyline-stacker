import { cloneTuning } from '../../src/config';
import { advance, output } from '../../src/prng';
import { createSim } from '../../src/sim';
import { DEFAULT_TUNING } from '../../src/tuning';
import { RESULT_NONE } from '../../src/types';
import type { SimConfig, TowerType } from '../../src/types';

const TYPE_ROUND_ROBIN: readonly TowerType[] = ['residential', 'commercial', 'office', 'luxury'];
const MAX_TICKS = 6000;

function assertAllSafeIntegers(state: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(state)) {
    if (key === 'restX') {
      const arr = value as number[];
      for (let i = 0; i < arr.length; i += 1) {
        if (!Number.isSafeInteger(arr[i])) {
          throw new Error(`restX[${String(i)}] is not a safe integer: ${String(arr[i])}`);
        }
      }
      continue;
    }
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
      throw new Error(`field "${key}" is not a safe integer: ${String(value)}`);
    }
  }
}

function runOne(seed: number, roundRobinIndex: number, log: string[]): void {
  const isQuick = roundRobinIndex === 4;
  const type: TowerType = isQuick
    ? 'residential'
    : (TYPE_ROUND_ROBIN[roundRobinIndex] ?? 'residential');
  const mode: SimConfig['mode'] = isQuick ? 'quick' : 'city';

  const config: SimConfig = {
    type,
    mode,
    seed,
    assist: seed % 2 === 0,
    tuning: cloneTuning(DEFAULT_TUNING),
  };

  const sim = createSim(config);
  let gapState = advance(seed ^ 0x9e3779b9);
  let nextInputAt = -1;

  for (let tick = 0; tick < MAX_TICKS; tick += 1) {
    if (sim.getState().result !== RESULT_NONE) break;
    sim.step();
    assertAllSafeIntegers(sim.getState());

    if (sim.getState().tick >= nextInputAt) {
      gapState = advance(gapState);
      const gap = output(gapState) % 201; // 0..200 ticks
      nextInputAt = sim.getState().tick + gap;

      gapState = advance(gapState);
      const wantRoof = mode === 'city' && output(gapState) % 5 === 0;

      if (wantRoof && sim.requestRoof()) {
        log.push(`roof@${String(sim.getState().tick)}`);
      } else if (sim.requestDrop()) {
        log.push(`drop@${String(sim.getState().tick)}`);
      }
    }
  }
}

/** Runs `count` fuzz iterations starting at `startSeed` (research R15, SC-002). */
export function runFuzz(startSeed: number, count: number): void {
  let rngState = startSeed;

  for (let iteration = 0; iteration < count; iteration += 1) {
    rngState = advance(rngState);
    const seed = output(rngState);
    const roundRobinIndex = (startSeed + iteration) % 5;
    const log: string[] = [];

    try {
      runOne(seed, roundRobinIndex, log);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `fuzz failure at seed ${String(seed)} (round-robin ${String(roundRobinIndex)}): ${message}\nlog: ${log.join(', ')}`,
        { cause: err },
      );
    }
  }
}
