import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanBundle } from '../check-prod-bundle';

describe('scanBundle', () => {
  let distDir: string;

  afterEach(() => {
    rmSync(distDir, { recursive: true, force: true });
  });

  it('accepts a plain production build with no tuning-panel or perf-tools markers', () => {
    distDir = mkdtempSync(join(tmpdir(), 'check-prod-bundle-test-'));
    writeFileSync(join(distDir, 'index-abc123.js'), 'console.log(`hello`);');
    expect(scanBundle(distDir)).toEqual([]);
  });

  it('flags a tuning-panel marker string', () => {
    distDir = mkdtempSync(join(tmpdir(), 'check-prod-bundle-test-'));
    writeFileSync(join(distDir, 'index-abc123.js'), 'const id = `skyline-tuning-panel`;');
    const violations = scanBundle(distDir);
    expect(violations.some((v) => v.includes('tuning-panel'))).toBe(true);
  });

  it('flags an AutoBot chunk file, as emitted by a VITE_PERF_TOOLS=1 build', () => {
    distDir = mkdtempSync(join(tmpdir(), 'check-prod-bundle-test-'));
    writeFileSync(join(distDir, 'AutoBot-CneyxFOV.js'), 'export{f as AutoBot};');
    const violations = scanBundle(distDir);
    expect(violations.some((v) => v.includes('AutoBot-CneyxFOV.js'))).toBe(true);
  });

  it('flags a PerfCapture chunk file, as emitted by a VITE_PERF_TOOLS=1 build', () => {
    distDir = mkdtempSync(join(tmpdir(), 'check-prod-bundle-test-'));
    writeFileSync(join(distDir, 'PerfCapture-rQMglbCg.js'), 'export{a as PerfCapture};');
    const violations = scanBundle(distDir);
    expect(violations.some((v) => v.includes('PerfCapture-rQMglbCg.js'))).toBe(true);
  });

  it('flags the AutoBot/PerfCapture export marker even inside another file', () => {
    distDir = mkdtempSync(join(tmpdir(), 'check-prod-bundle-test-'));
    writeFileSync(
      join(distDir, 'index-abc123.js'),
      'export{f as AutoBot};export{a as PerfCapture};',
    );
    const violations = scanBundle(distDir);
    expect(violations.some((v) => v.includes('as AutoBot'))).toBe(true);
    expect(violations.some((v) => v.includes('as PerfCapture'))).toBe(true);
  });

  it('does not flag an unrelated file that merely contains "Bot" or "Capture" as a substring', () => {
    distDir = mkdtempSync(join(tmpdir(), 'check-prod-bundle-test-'));
    writeFileSync(join(distDir, 'index-abc123.js'), 'class RobotCaptureThing {}');
    expect(scanBundle(distDir)).toEqual([]);
  });
});
