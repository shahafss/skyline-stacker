import { expect, test, type Page } from '@playwright/test';

async function waitForSkyline(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__skyline !== undefined);
}

async function currentTick(page: Page): Promise<number> {
  return page.evaluate(() => window.__skyline?.getState().tick ?? 0);
}

async function logLength(page: Page): Promise<number> {
  return page.evaluate(() => window.__skyline?.getInputLog().length ?? 0);
}

/** Asserts the most recent input log entry landed shortly after `tickBefore` (SC-009). */
async function expectRecentDrop(
  page: Page,
  tickBefore: number,
  lengthBefore: number,
): Promise<void> {
  await page.waitForFunction(
    (before) => (window.__skyline?.getInputLog().length ?? 0) > before,
    lengthBefore,
  );
  const log = await page.evaluate(() => window.__skyline?.getInputLog() ?? []);
  const last = log.at(-1);
  expect(last).toBeDefined();
  expect(last?.type).toBe('drop');
  // The drop is applied on tick + 1 at request time; allow slack for the round trip between the
  // test driver and the page's own render loop (a fresh touch context is noticeably slower here).
  expect(last?.tick).toBeGreaterThan(tickBefore);
  expect(last?.tick).toBeLessThanOrEqual(tickBefore + 20);
}

test.describe('playability', () => {
  test('Space, pointer and touch each produce a drop on the next tick', async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await waitForSkyline(page);

    // Wait until a block has actually spawned (swinging), so drop requests can be accepted.
    await page.waitForTimeout(700);

    let tickBefore = await currentTick(page);
    let lenBefore = await logLength(page);
    await page.keyboard.press('Space');
    await expectRecentDrop(page, tickBefore, lenBefore);

    // Wait for the next spawn before the next input.
    await page.waitForTimeout(1200);

    tickBefore = await currentTick(page);
    lenBefore = await logLength(page);
    const canvas = page.locator('canvas');
    await canvas.click();
    await expectRecentDrop(page, tickBefore, lenBefore);

    await page.waitForTimeout(1200);

    const touchContext = await browser.newContext({
      hasTouch: true,
      viewport: { width: 390, height: 844 },
    });
    const touchPage = await touchContext.newPage();
    await touchPage.goto('/');
    await waitForSkyline(touchPage);
    await touchPage.waitForTimeout(700);

    const touchTickBefore = await currentTick(touchPage);
    const touchLenBefore = await logLength(touchPage);
    await touchPage.locator('canvas').tap();
    await expectRecentDrop(touchPage, touchTickBefore, touchLenBefore);

    await touchContext.close();
  });

  test('repeated drops eventually reach a result and show the HUD banner', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await waitForSkyline(page);
    await page.waitForTimeout(700);

    let result: Awaited<ReturnType<NonNullable<Window['__skyline']>['getResult']>> = null;
    for (let attempt = 0; attempt < 40 && result === null; attempt += 1) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(1100);
      result = await page.evaluate(() => window.__skyline?.getResult() ?? null);
    }

    expect(result).not.toBeNull();
    expect(['completed', 'built', 'gameOver']).toContain(result?.result);

    const bannerVisible = await page.evaluate(() => window.__skyline?.isResultVisible() ?? false);
    expect(bannerVisible).toBe(true);
  });
});
