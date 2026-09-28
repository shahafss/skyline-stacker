import { describe, it } from 'vitest';
import { FUZZ_TIMEOUT_MS, runFuzz } from './harness';

describe('fuzz batch 1', () => {
  it(
    'runs 2000 random configs without producing an unsafe integer',
    () => {
      runFuzz(1, 2000);
    },
    FUZZ_TIMEOUT_MS,
  );
});
