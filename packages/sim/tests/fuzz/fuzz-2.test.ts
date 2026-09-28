import { describe, it } from 'vitest';
import { FUZZ_TIMEOUT_MS, runFuzz } from './harness';

describe('fuzz batch 2', () => {
  it(
    'runs 2000 random configs without producing an unsafe integer',
    () => {
      runFuzz(2_000_001, 2000);
    },
    FUZZ_TIMEOUT_MS,
  );
});
