/**
 * Every user-facing English string in `apps/web` (constitution Principle VII). Components import
 * from here instead of writing literal text. Exempt: the dev-only tuning panel and perf report,
 * which are excluded from production builds (plan.md interpretations).
 */
export const STRINGS = Object.freeze({
  typeNames: Object.freeze({
    residential: 'Residential',
    commercial: 'Commercial',
    office: 'Office',
    luxury: 'Luxury',
  }),
  quickPlay: 'Quick Play',
  hud: Object.freeze({
    score: 'Score',
    lives: 'Lives',
    combo: 'Combo',
    floors: 'Floors',
    assist: 'ASSIST',
    placeRoof: 'Place Roof',
  }),
  result: Object.freeze({
    completed: 'COMPLETED',
    built: 'BUILT',
    gameOver: 'GAME OVER',
    playAgain: 'Press Space or tap to play again',
  }),
  selector: Object.freeze({
    title: 'Skyline Stacker',
    hint: 'Press 1-4 for a city, 5 or Q for Quick Play, or use ↑ ↓ and Enter',
    assistLabel: 'Steady Tower',
    assistOn: 'Assist: ON',
    assistOff: 'Assist: OFF',
  }),
  runExported: 'Run exported',
  debug: Object.freeze({
    tick: 'Tick',
    lastOffset: 'Offset ‰',
    lastTier: 'Tier',
    swayTarget: 'Sway target',
    swayAmp: 'Sway amp',
    lean: 'Lean',
    craneSpeed: 'Crane speed ‰',
    sensitivity: 'Sensitivity ‰',
    stabilizer: 'Stabilizer ‰',
    combo: 'Combo',
    fps: 'FPS',
  }),
});

/** Formats a `comboMult` value in ‰ (e.g. 1750) as "×1.75". */
export function formatCombo(multPermille: number): string {
  return `×${(multPermille / 1000).toFixed(2)}`;
}

/** Formats floor progress. With `target`, "12 / 40"; without it (Quick Play), "12". */
export function formatFloors(n: number, target?: number): string {
  return target === undefined ? String(n) : `${String(n)} / ${String(target)}`;
}
