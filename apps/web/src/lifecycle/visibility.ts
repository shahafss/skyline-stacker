import type Phaser from 'phaser';

/** The subset of `FixedStepLoop` the auto-pause lifecycle needs. */
export interface Pausable {
  pause(): void;
  resume(): void;
}

/**
 * Auto-pauses the loop when the tab is hidden or the app is backgrounded, and resumes (with the
 * accumulator reset, via `loop.resume()`) when it comes back (FR-035). Listens to both the DOM
 * `visibilitychange` event and Phaser's own `hidden`/`visible` game events, since Phaser fires the
 * latter for some backgrounding cases the DOM event misses.
 */
export function setupVisibilityAutoPause(game: Phaser.Game, loop: Pausable): () => void {
  const onDocVisibility = (): void => {
    if (document.hidden) {
      loop.pause();
    } else {
      loop.resume();
    }
  };
  const onHidden = (): void => {
    loop.pause();
  };
  const onVisible = (): void => {
    loop.resume();
  };

  document.addEventListener('visibilitychange', onDocVisibility);
  game.events.on('hidden', onHidden);
  game.events.on('visible', onVisible);

  return () => {
    document.removeEventListener('visibilitychange', onDocVisibility);
    game.events.off('hidden', onHidden);
    game.events.off('visible', onVisible);
  };
}
