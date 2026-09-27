import { expect, test } from '@playwright/test';

interface GoldenResult {
  name: string;
  score: number;
  result: string;
  floors: number;
  hash: number;
  expected: { score: number; result: string; floors: number; hash: number };
}

test('every golden fixture replays to its committed score, result, floors and hash', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(
    () => (window as unknown as { __goldenResults?: unknown }).__goldenResults !== undefined,
  );

  const results = await page.evaluate(
    () => (window as unknown as { __goldenResults: GoldenResult[] }).__goldenResults,
  );

  expect(results.length).toBeGreaterThan(0);

  for (const r of results) {
    expect(r.score, `${r.name} score`).toBe(r.expected.score);
    expect(r.result, `${r.name} result`).toBe(r.expected.result);
    expect(r.floors, `${r.name} floors`).toBe(r.expected.floors);
    expect(r.hash, `${r.name} hash`).toBe(r.expected.hash);
  }
});
