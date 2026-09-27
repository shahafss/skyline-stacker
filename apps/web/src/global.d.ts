/** True when built with `VITE_PERF_TOOLS=1` (contracts/controls.md: perf capture, auto-bot). */
declare const __PERF_TOOLS__: boolean;

interface Window {
  /** Dev-build hook for Playwright (T074): the live sim's read-only surface. */
  __skyline?: {
    getState: () => import('@skyline/sim').SimState;
    getInputLog: () => readonly import('@skyline/sim').InputEvent[];
    getResult: () => import('@skyline/sim').RunResult | null;
    isResultVisible: () => boolean;
    isRoofButtonVisible: () => boolean;
    getRoofButtonBounds: () => { x: number; y: number; width: number; height: number } | null;
  };
}
