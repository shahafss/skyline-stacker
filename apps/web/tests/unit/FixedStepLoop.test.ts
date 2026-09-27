import { describe, expect, it, vi } from 'vitest';
import { FixedStepLoop, TICK_MS, type RenderSnapshot } from '../../src/loop/FixedStepLoop';

function makeLoop() {
  let tick = 0;
  const stepped: number[] = [];
  const step = vi.fn(() => {
    tick += 1;
    stepped.push(tick);
    return [{ kind: 'tick', tick }];
  });
  const readSnapshot = vi.fn((out: RenderSnapshot) => {
    out.craneX = tick * 10;
    out.swayS = tick * 2;
    out.fallTicks = tick;
    out.cameraTargetY = tick * 5;
  });
  const onEvents = vi.fn();
  const loop = new FixedStepLoop({ step, readSnapshot, onEvents });
  return { loop, step, readSnapshot, onEvents, stepped };
}

describe('FixedStepLoop', () => {
  it('runs one step per frame at 60 Hz deltas', () => {
    const { loop, step } = makeLoop();
    for (let i = 0; i < 10; i += 1) {
      const steps = loop.advance(TICK_MS);
      expect(steps).toBe(1);
    }
    expect(step).toHaveBeenCalledTimes(10);
  });

  it('runs exactly MAX_TICKS_PER_FRAME steps on a 100ms delta and discards the rest', () => {
    const { loop, step } = makeLoop();
    const steps = loop.advance(100);
    expect(steps).toBe(5);
    expect(step).toHaveBeenCalledTimes(5);
    expect(loop.alpha).toBe(0);

    // The next frame does not receive the discarded leftover time.
    const steps2 = loop.advance(0);
    expect(steps2).toBe(0);
  });

  it('keeps alpha in [0, 1)', () => {
    const { loop } = makeLoop();
    for (const delta of [1000 / 30, 1000 / 60, 1000 / 120, 1000 / 144, 100, 1]) {
      loop.advance(delta);
      expect(loop.alpha).toBeGreaterThanOrEqual(0);
      expect(loop.alpha).toBeLessThan(1);
    }
  });

  it('copies curr into prev before each step', () => {
    const { loop } = makeLoop();
    loop.advance(TICK_MS);
    expect(loop.prev.craneX).toBe(0);
    expect(loop.curr.craneX).toBe(10);

    loop.advance(TICK_MS);
    expect(loop.prev.craneX).toBe(10);
    expect(loop.curr.craneX).toBe(20);
    expect(loop.prev.swayS).toBe(2);
    expect(loop.prev.fallTicks).toBe(1);
    expect(loop.prev.cameraTargetY).toBe(5);
  });

  it('pause() stops steps and resume() resets the accumulator', () => {
    const { loop, step } = makeLoop();
    loop.advance(TICK_MS / 2);
    loop.pause();
    expect(loop.advance(1000)).toBe(0);
    expect(step).not.toHaveBeenCalled();

    loop.resume();
    // The half-tick accumulated before pause is gone; one full tick is needed again.
    expect(loop.advance(TICK_MS / 2)).toBe(0);
    expect(loop.advance(TICK_MS / 2)).toBe(1);
  });

  it('forwards events without copying', () => {
    const { loop, onEvents } = makeLoop();
    loop.advance(TICK_MS);
    expect(onEvents).toHaveBeenCalledTimes(1);
    expect(onEvents).toHaveBeenCalledWith([{ kind: 'tick', tick: 1 }]);
  });

  it('performs no allocations per advance(): snapshot objects keep their identity', () => {
    const { loop } = makeLoop();
    const prevRef = loop.prev;
    const currRef = loop.curr;
    for (let i = 0; i < 20; i += 1) {
      loop.advance(TICK_MS);
    }
    expect(loop.prev).toBe(prevRef);
    expect(loop.curr).toBe(currRef);
  });
});
