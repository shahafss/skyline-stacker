import { describe, it } from 'vitest';
import { runFuzz } from './harness';

describe('fuzz batch 3', () => {
  it('runs 2000 random configs without producing an unsafe integer', () => {
    runFuzz(4_000_001, 2000);
  });
});
