/**
 * mulberry32, split into state advance and output extraction so callers can avoid allocation
 * (research R3, PRD §5.3). Usage: `state = advance(state); const draw = output(state);`
 */

/** Advances the uint32 PRNG state by one step. */
export function advance(state: number): number {
  return (state + 0x6d2b79f5) >>> 0;
}

/** Extracts the uint32 output for the given (already advanced) state. */
export function output(state: number): number {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) | 0;
  return (t ^ (t >>> 14)) >>> 0;
}
