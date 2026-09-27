import { parseRunExport, replay } from '@skyline/sim';

interface GoldenResult {
  name: string;
  score: number;
  result: string;
  floors: number;
  hash: number;
  expected: { score: number; result: string; floors: number; hash: number };
}

declare global {
  interface Window {
    __goldenResults?: GoldenResult[];
  }
}

const modules = import.meta.glob<{ default: unknown }>('../../sim/tests/golden/fixtures/*.json', {
  eager: true,
});

const results: GoldenResult[] = Object.entries(modules).map(([path, mod]) => {
  const name = path.split('/').pop() ?? path;
  const fixture = parseRunExport(mod.default);
  const replayed = replay(fixture.config, fixture.inputLog);
  const finalResult = replayed.result ?? { score: -1, result: 'none', floors: -1 };
  return {
    name,
    score: finalResult.score,
    result: finalResult.result,
    floors: finalResult.floors,
    hash: replayed.hash,
    expected: {
      score: fixture.result.score,
      result: fixture.result.result,
      floors: fixture.result.floors,
      hash: fixture.hash,
    },
  };
});

window.__goldenResults = results;
