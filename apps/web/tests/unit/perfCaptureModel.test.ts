import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_BUFFER_SIZE,
  CAPTURE_DURATION_MS,
  MAX_FPS_CAPACITY,
  OVER_BUDGET_MS,
  computePerfReport,
  createCaptureBuffer,
  isCaptureComplete,
  recordFrame,
} from '../../src/dev/perfCaptureModel';

describe('createCaptureBuffer', () => {
  it('preallocates a Float64Array of 60s * 150fps capacity (Principle VI: no per-frame allocation)', () => {
    const buffer = createCaptureBuffer();
    expect(buffer).toBeInstanceOf(Float64Array);
    expect(buffer.length).toBe(60 * 150);
    expect(buffer.length).toBe(CAPTURE_BUFFER_SIZE);
    expect(CAPTURE_BUFFER_SIZE).toBe(60 * MAX_FPS_CAPACITY);
  });
});

describe('recordFrame', () => {
  it('writes the frame time at the given index and returns the next index', () => {
    const buffer = createCaptureBuffer();
    const next = recordFrame(buffer, 0, 16.6);
    expect(next).toBe(1);
    expect(buffer[0]).toBe(16.6);
  });

  it('mutates the same buffer in place without allocating a new one', () => {
    const buffer = createCaptureBuffer();
    const identity = buffer;
    let index = 0;
    for (let i = 0; i < 5; i++) {
      index = recordFrame(buffer, index, i);
    }
    expect(Object.is(buffer, identity)).toBe(true);
    expect(index).toBe(5);
  });

  it('stops writing once the buffer is full instead of overflowing', () => {
    const buffer = new Float64Array(2);
    let index = recordFrame(buffer, 0, 1);
    index = recordFrame(buffer, index, 2);
    // buffer is now full (index === buffer.length)
    expect(index).toBe(2);
    const after = recordFrame(buffer, index, 999);
    expect(after).toBe(2);
    expect(Array.from(buffer)).toEqual([1, 2]);
  });
});

describe('isCaptureComplete', () => {
  it('is complete once elapsed time reaches the 60s duration', () => {
    expect(isCaptureComplete(CAPTURE_DURATION_MS, 10, 9000)).toBe(true);
    expect(isCaptureComplete(CAPTURE_DURATION_MS - 1, 10, 9000)).toBe(false);
  });

  it('is complete once the count reaches the buffer capacity, even before 60s', () => {
    expect(isCaptureComplete(1000, 9000, 9000)).toBe(true);
    expect(isCaptureComplete(1000, 8999, 9000)).toBe(false);
  });
});

describe('computePerfReport', () => {
  it('computes average fps, max frame ms and the count of frames over 33ms', () => {
    const buffer = createCaptureBuffer();
    const frames = [16, 16, 40, 50, 16];
    let count = 0;
    for (const ms of frames) {
      count = recordFrame(buffer, count, ms);
    }

    const report = computePerfReport(buffer, count);

    expect(report.frameCount).toBe(5);
    expect(report.maxFrameMs).toBe(50);
    expect(report.overBudgetCount).toBe(2); // 40 and 50 are over OVER_BUDGET_MS (33)
    const expectedAverageMs = (16 + 16 + 40 + 50 + 16) / 5;
    expect(report.averageFps).toBeCloseTo(1000 / expectedAverageMs, 5);
  });

  it('ignores trailing unwritten buffer slots beyond count', () => {
    const buffer = createCaptureBuffer();
    buffer[0] = 16;
    buffer[1] = 16;
    // buffer[2..] left at 0, but count says only 2 samples were recorded
    const report = computePerfReport(buffer, 2);

    expect(report.frameCount).toBe(2);
    expect(report.maxFrameMs).toBe(16);
    expect(report.overBudgetCount).toBe(0);
  });

  it('returns a zeroed report for zero recorded frames', () => {
    const buffer = createCaptureBuffer();
    const report = computePerfReport(buffer, 0);
    expect(report).toEqual({
      frameCount: 0,
      averageFps: 0,
      maxFrameMs: 0,
      overBudgetCount: 0,
    });
  });

  it('treats exactly OVER_BUDGET_MS as not over budget (boundary)', () => {
    const buffer = createCaptureBuffer();
    let count = recordFrame(buffer, 0, OVER_BUDGET_MS);
    count = recordFrame(buffer, count, OVER_BUDGET_MS + 0.001);
    const report = computePerfReport(buffer, count);
    expect(report.overBudgetCount).toBe(1);
  });
});

describe('GameScene wiring: raw (unsmoothed) frame times (C2)', () => {
  it('feeds PerfCapture.update from game.loop.rawDelta, not the 10-frame-smoothed delta', () => {
    // Phaser 4.2.1's `delta` argument to `update(time, delta)` is averaged over the last 10
    // frames, so it under-reports the true worst frame and can hide over-33ms frames entirely.
    // perfCaptureModel itself is delta-agnostic (it just records whatever ms it's handed), so the
    // fix lives in the Phaser-dependent call site; this checks that call site without importing
    // Phaser.
    const path = fileURLToPath(new URL('../../src/scenes/GameScene.ts', import.meta.url));
    const source = readFileSync(path, 'utf8');
    expect(source).toMatch(/perfCapture\?\.update\(this\.game\.loop\.rawDelta\)/);
    expect(source).not.toMatch(/perfCapture\?\.update\(delta\)/);
  });
});
