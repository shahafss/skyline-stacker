/**
 * Phaser-free and DOM-free model behind the dev-only perf capture (T090, research R16). Pure
 * math only: no Phaser import, no wall-clock read (the caller supplies elapsed/delta ms), no
 * network or filesystem access.
 */

/** Capture duration (research R16): a scripted 60-second run. */
export const CAPTURE_DURATION_MS = 60_000;

/** Sample capacity per second: covers up to a 150 Hz display without dropping frames or
 * reallocating the buffer mid-capture (Principle VI: no per-frame allocation). */
export const MAX_FPS_CAPACITY = 150;

/** Total preallocated sample slots: 60s * 150fps. */
export const CAPTURE_BUFFER_SIZE = 60 * MAX_FPS_CAPACITY;

/** A frame taking longer than this misses the 30 fps budget (contracts/controls.md, SC-010). */
export const OVER_BUDGET_MS = 33;

/** The perf capture's report: average fps, worst single frame, and how many missed budget. */
export interface PerfReport {
  readonly frameCount: number;
  readonly averageFps: number;
  readonly maxFrameMs: number;
  readonly overBudgetCount: number;
}

/** Allocates the preallocated frame-time buffer once, reused for the whole capture. */
export function createCaptureBuffer(): Float64Array {
  return new Float64Array(CAPTURE_BUFFER_SIZE);
}

/**
 * Writes `frameMs` at `index` and returns the next index, without allocating. Once the buffer is
 * full, further samples are silently dropped (the report is computed from what fit).
 */
export function recordFrame(buffer: Float64Array, index: number, frameMs: number): number {
  if (index >= buffer.length) {
    return index;
  }
  buffer[index] = frameMs;
  return index + 1;
}

/** True once the 60s duration has elapsed, or the buffer is full, whichever comes first. */
export function isCaptureComplete(elapsedMs: number, count: number, bufferLength: number): boolean {
  return elapsedMs >= CAPTURE_DURATION_MS || count >= bufferLength;
}

/** Computes the report from the first `count` samples of `buffer`; later slots are ignored. */
export function computePerfReport(buffer: Float64Array, count: number): PerfReport {
  if (count <= 0) {
    return { frameCount: 0, averageFps: 0, maxFrameMs: 0, overBudgetCount: 0 };
  }
  let total = 0;
  let max = 0;
  let overBudgetCount = 0;
  for (let i = 0; i < count; i++) {
    const ms = buffer[i] ?? 0;
    total += ms;
    if (ms > max) {
      max = ms;
    }
    if (ms > OVER_BUDGET_MS) {
      overBudgetCount += 1;
    }
  }
  const averageMs = total / count;
  const averageFps = averageMs > 0 ? 1000 / averageMs : 0;
  return { frameCount: count, averageFps, maxFrameMs: max, overBudgetCount };
}

/** Formats the report as dev-only overlay text (exempt from `strings.ts`, plan.md interpretations). */
export function formatPerfReport(report: PerfReport): string {
  return [
    'Perf capture complete',
    `Frames: ${String(report.frameCount)}`,
    `Avg fps: ${report.averageFps.toFixed(1)}`,
    `Max frame: ${report.maxFrameMs.toFixed(1)} ms`,
    `Over 33ms: ${String(report.overBudgetCount)}`,
  ].join('\n');
}
