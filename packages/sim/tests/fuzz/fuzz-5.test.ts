import { describe, it } from 'vitest';
import { runFuzz } from './harness';

describe('fuzz batch 5', () => {
  it('runs 2000 random configs without producing an unsafe integer', () => {
    runFuzz(8_000_001, 2000);
  });
});
