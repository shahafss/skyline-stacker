import { expect, test, type Page } from '@playwright/test';
import { INPUT_NONE, PHASE_SWINGING } from '@skyline/sim';

async function waitForSkyline(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__skyline !== undefined);
}

interface StateSnapshot {
  floors: number;
  phase: number;
  pendingInput: number;
  craneX: number;
  top: number;
  resultIsNull: boolean;
}

async function readState(page: Page): Promise<StateSnapshot | null> {
  return page.evaluate(() => {
    const state = window.__skyline?.getState();
    if (!state) {
      return null;
    }
    return {
      floors: state.floors,
      phase: state.phase,
      pendingInput: state.pendingInput,
      craneX: state.craneX,
      top: state.restX[state.floors] ?? 0,
      resultIsNull: window.__skyline?.getResult() === null,
    };
  });
}

/** Presses Space near the crane's zero crossing until `targetFloors` is reached (or times out). */
async function playToFloors(page: Page, targetFloors: number): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const snapshot = await readState(page);
    if (!snapshot || !snapshot.resultIsNull) {
      return;
    }
    if (snapshot.floors >= targetFloors) {
      return;
    }
    if (
      snapshot.phase === PHASE_SWINGING &&
      snapshot.pendingInput === INPUT_NONE &&
      Math.abs(snapshot.craneX - snapshot.top) < 120
    ) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(450);
    } else {
      await page.waitForTimeout(20);
    }
  }
  throw new Error(`did not reach ${String(targetFloors)} floors in time`);
}

async function startRun(page: Page, key: string): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(300);
  await page.keyboard.press(key);
  await waitForSkyline(page);
  await page.waitForTimeout(400);
}

test.describe('Place Roof', () => {
  test('placing the roof logs a roof entry, keeps swinging, and hides the button', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await startRun(page, '2'); // Commercial: minRoofFloors = 20

    await playToFloors(page, 20);
    const snapshot = await readState(page);
    expect(snapshot?.floors).toBeGreaterThanOrEqual(20);

    await page.waitForFunction(() => window.__skyline?.isRoofButtonVisible() === true);

    const bounds = await page.evaluate(() => window.__skyline?.getRoofButtonBounds() ?? null);
    expect(bounds).not.toBeNull();
    const canvasBox = await page.locator('canvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!bounds || !canvasBox) {
      throw new Error('missing bounds');
    }

    // Scale.FIT: the canvas keeps the 720x1280 aspect ratio; map game px to page px.
    const scale = canvasBox.width / 720;
    const clickX = canvasBox.x + (bounds.x + bounds.width / 2) * scale;
    const clickY = canvasBox.y + (bounds.y + bounds.height / 2) * scale;

    const logLenBefore = await page.evaluate(() => window.__skyline?.getInputLog().length ?? 0);

    await page.mouse.click(clickX, clickY);

    await page.waitForFunction(
      (before) => (window.__skyline?.getInputLog().length ?? 0) > before,
      logLenBefore,
    );

    const log = await page.evaluate(() => window.__skyline?.getInputLog() ?? []);
    const newEntries = log.slice(logLenBefore);
    expect(newEntries).toHaveLength(1);
    expect(newEntries[0]?.type).toBe('roof');

    const stillSwinging = await page.evaluate(
      () => window.__skyline?.getState().phase === 1, // PHASE_SWINGING
    );
    expect(stillSwinging).toBe(true);

    await page.waitForFunction(() => window.__skyline?.isRoofButtonVisible() === false);
  });

  test('Quick Play never shows the Place Roof button', async ({ page }) => {
    test.setTimeout(60_000);
    await startRun(page, '5');

    for (let i = 0; i < 6; i += 1) {
      const visible = await page.evaluate(() => window.__skyline?.isRoofButtonVisible() ?? false);
      expect(visible).toBe(false);
      await page.keyboard.press('Space');
      await page.waitForTimeout(600);
    }
  });
});
