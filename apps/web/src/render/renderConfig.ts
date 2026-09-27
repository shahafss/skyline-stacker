import type { TowerType } from '@skyline/sim';

/**
 * Rendering styling values (Principle V exemption: render-only, not gameplay tuning). Not
 * hashed and not part of `SimConfig`.
 */

/** Pixels per simulation unit. A 1000 su block is 200 px wide. */
export const PX_PER_SU = 0.2;

/** Base rendered block height in pixels, before a type's `blockVisualHeight` scaling. */
export const BASE_BLOCK_HEIGHT_PX = 90;

/** Per-type tint color (Principle VII: never the only way to tell types apart). */
export const TYPE_COLORS: Readonly<Record<TowerType, number>> = Object.freeze({
  residential: 0x3b82f6,
  commercial: 0xef4444,
  office: 0x22c55e,
  luxury: 0xeab308,
});

/** Camera horizontal-follow smoothing factor per frame (0..1; higher snaps faster). */
export const CAMERA_HORIZONTAL_SMOOTHING = 0.1;

/** Camera vertical-pan smoothing factor per frame (0..1; higher snaps faster). */
export const CAMERA_VERTICAL_SMOOTHING = 0.08;

/** HUD backing panel fill color. */
export const HUD_PANEL_COLOR = 0x111827;

/** HUD backing panel alpha. */
export const HUD_PANEL_ALPHA = 0.85;

/** HUD text color. */
export const HUD_TEXT_COLOR = '#ffffff';
