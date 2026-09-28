import type Phaser from 'phaser';
import type { TowerType } from '@skyline/sim';

/** Pixel width of a generated floor/roof texture (matches `renderConfig.PX_PER_SU * BLOCK_WIDTH`). */
export const TYPE_ART_WIDTH = 200;
/** Pixel height of a generated floor/roof texture, before per-type `blockVisualHeight` scaling. */
export const TYPE_ART_HEIGHT = 100;
/** Pixel size of a generated icon texture (square). */
export const TYPE_ART_ICON_SIZE = 64;

const FILL = 0xffffff;
const MID = 0x999999;
const DARK = 0x444444;

const TOWER_TYPES: readonly TowerType[] = ['residential', 'commercial', 'office', 'luxury'];

/** Texture key for a type's floor face pattern. */
export function floorTextureKey(type: TowerType): string {
  return `floor-${type}`;
}

/** Texture key for a type's roof top shape. */
export function roofTextureKey(type: TowerType): string {
  return `roof-${type}`;
}

/** Texture key for a type's HUD/selector icon. */
export function iconTextureKey(type: TowerType): string {
  return `icon-${type}`;
}

function makeGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({}, false);
}

function generate(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = makeGraphics(scene);
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

function drawFloorFace(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(FILL, 1);
  g.fillRect(0, 0, TYPE_ART_WIDTH, TYPE_ART_HEIGHT);
  g.lineStyle(2, DARK, 1);
  g.strokeRect(1, 1, TYPE_ART_WIDTH - 2, TYPE_ART_HEIGHT - 2);
}

// Residential: horizontal balcony stripes; pitched (triangle) roof; house icon.
function drawResidentialFloor(g: Phaser.GameObjects.Graphics): void {
  drawFloorFace(g);
  g.lineStyle(2, MID, 1);
  for (let y = 20; y < TYPE_ART_HEIGHT; y += 20) {
    g.lineBetween(0, y, TYPE_ART_WIDTH, y);
  }
  g.fillStyle(MID, 1);
  for (let x = 15; x < TYPE_ART_WIDTH; x += 40) {
    g.fillRect(x, 10, 20, 6);
  }
}

function drawResidentialRoof(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(FILL, 1);
  g.beginPath();
  g.moveTo(TYPE_ART_WIDTH / 2, 5);
  g.lineTo(TYPE_ART_WIDTH - 5, TYPE_ART_HEIGHT - 5);
  g.lineTo(5, TYPE_ART_HEIGHT - 5);
  g.closePath();
  g.fillPath();
  g.lineStyle(3, DARK, 1);
  g.strokePath();
}

function drawResidentialIcon(g: Phaser.GameObjects.Graphics): void {
  const s = TYPE_ART_ICON_SIZE;
  g.fillStyle(FILL, 1);
  g.fillRect(s * 0.2, s * 0.5, s * 0.6, s * 0.4);
  g.beginPath();
  g.moveTo(s * 0.5, s * 0.1);
  g.lineTo(s * 0.85, s * 0.5);
  g.lineTo(s * 0.15, s * 0.5);
  g.closePath();
  g.fillPath();
  g.lineStyle(3, DARK, 1);
  g.strokeRect(s * 0.2, s * 0.5, s * 0.6, s * 0.4);
  g.strokePath();
}

// Commercial: striped awning band at the base of each floor; flat roof with a sign board; awning icon.
function drawCommercialFloor(g: Phaser.GameObjects.Graphics): void {
  drawFloorFace(g);
  const awningTop = TYPE_ART_HEIGHT - 24;
  let toggle = false;
  for (let x = 0; x < TYPE_ART_WIDTH; x += 20) {
    g.fillStyle(toggle ? MID : FILL, 1);
    g.fillRect(x, awningTop, 20, 24);
    toggle = !toggle;
  }
  g.lineStyle(2, DARK, 1);
  g.strokeRect(0, awningTop, TYPE_ART_WIDTH, 24);
}

function drawCommercialRoof(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(FILL, 1);
  g.fillRect(5, TYPE_ART_HEIGHT - 20, TYPE_ART_WIDTH - 10, 15);
  g.fillRect(TYPE_ART_WIDTH / 2 - 20, TYPE_ART_HEIGHT - 40, 40, 20);
  g.lineStyle(3, DARK, 1);
  g.strokeRect(5, TYPE_ART_HEIGHT - 20, TYPE_ART_WIDTH - 10, 15);
  g.strokeRect(TYPE_ART_WIDTH / 2 - 20, TYPE_ART_HEIGHT - 40, 40, 20);
}

function drawCommercialIcon(g: Phaser.GameObjects.Graphics): void {
  const s = TYPE_ART_ICON_SIZE;
  g.fillStyle(FILL, 1);
  g.beginPath();
  g.arc(s * 0.5, s * 0.55, s * 0.35, Math.PI, 0, false);
  g.closePath();
  g.fillPath();
  let toggle = false;
  for (let x = s * 0.15; x < s * 0.85; x += s * 0.14) {
    g.fillStyle(toggle ? MID : FILL, 1);
    g.fillRect(x, s * 0.55, s * 0.14, s * 0.15);
    toggle = !toggle;
  }
  g.lineStyle(2, DARK, 1);
  g.strokeRect(s * 0.15, s * 0.55, s * 0.7, s * 0.15);
}

// Office: grid of window squares; flat stepped roof; grid icon.
function drawOfficeFloor(g: Phaser.GameObjects.Graphics): void {
  drawFloorFace(g);
  g.fillStyle(MID, 1);
  for (let y = 12; y < TYPE_ART_HEIGHT - 8; y += 22) {
    for (let x = 12; x < TYPE_ART_WIDTH - 8; x += 30) {
      g.fillRect(x, y, 18, 14);
    }
  }
}

function drawOfficeRoof(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(FILL, 1);
  g.fillRect(5, TYPE_ART_HEIGHT - 15, TYPE_ART_WIDTH - 10, 10);
  g.fillRect(TYPE_ART_WIDTH / 2 - 30, TYPE_ART_HEIGHT - 30, 60, 15);
  g.fillRect(TYPE_ART_WIDTH / 2 - 15, TYPE_ART_HEIGHT - 45, 30, 15);
  g.lineStyle(3, DARK, 1);
  g.strokeRect(5, TYPE_ART_HEIGHT - 15, TYPE_ART_WIDTH - 10, 10);
  g.strokeRect(TYPE_ART_WIDTH / 2 - 30, TYPE_ART_HEIGHT - 30, 60, 15);
  g.strokeRect(TYPE_ART_WIDTH / 2 - 15, TYPE_ART_HEIGHT - 45, 30, 15);
}

function drawOfficeIcon(g: Phaser.GameObjects.Graphics): void {
  const s = TYPE_ART_ICON_SIZE;
  g.lineStyle(3, DARK, 1);
  g.fillStyle(FILL, 1);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const x = s * 0.15 + col * s * 0.25;
      const y = s * 0.15 + row * s * 0.25;
      g.fillRect(x, y, s * 0.2, s * 0.2);
      g.strokeRect(x, y, s * 0.2, s * 0.2);
    }
  }
}

// Luxury: diamond (diagonal lattice) pattern; spire roof; crown/spire icon.
function drawLuxuryFloor(g: Phaser.GameObjects.Graphics): void {
  drawFloorFace(g);
  g.lineStyle(2, MID, 1);
  for (let offset = -TYPE_ART_HEIGHT; offset < TYPE_ART_WIDTH; offset += 20) {
    g.lineBetween(offset, 0, offset + TYPE_ART_HEIGHT, TYPE_ART_HEIGHT);
    g.lineBetween(offset, TYPE_ART_HEIGHT, offset + TYPE_ART_HEIGHT, 0);
  }
}

function drawLuxuryRoof(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(FILL, 1);
  g.beginPath();
  g.moveTo(TYPE_ART_WIDTH / 2, 0);
  g.lineTo(TYPE_ART_WIDTH / 2 + 10, TYPE_ART_HEIGHT - 10);
  g.lineTo(TYPE_ART_WIDTH / 2 - 10, TYPE_ART_HEIGHT - 10);
  g.closePath();
  g.fillPath();
  g.fillRect(5, TYPE_ART_HEIGHT - 10, TYPE_ART_WIDTH - 10, 8);
  g.lineStyle(3, DARK, 1);
  g.strokePath();
  g.strokeRect(5, TYPE_ART_HEIGHT - 10, TYPE_ART_WIDTH - 10, 8);
}

function drawLuxuryIcon(g: Phaser.GameObjects.Graphics): void {
  const s = TYPE_ART_ICON_SIZE;
  g.fillStyle(FILL, 1);
  g.beginPath();
  g.moveTo(s * 0.15, s * 0.75);
  g.lineTo(s * 0.15, s * 0.4);
  g.lineTo(s * 0.32, s * 0.55);
  g.lineTo(s * 0.5, s * 0.25);
  g.lineTo(s * 0.68, s * 0.55);
  g.lineTo(s * 0.85, s * 0.4);
  g.lineTo(s * 0.85, s * 0.75);
  g.closePath();
  g.fillPath();
  g.lineStyle(2, DARK, 1);
  g.strokePath();
}

const DRAWERS: Record<
  TowerType,
  {
    floor: (g: Phaser.GameObjects.Graphics) => void;
    roof: (g: Phaser.GameObjects.Graphics) => void;
    icon: (g: Phaser.GameObjects.Graphics) => void;
  }
> = {
  residential: {
    floor: drawResidentialFloor,
    roof: drawResidentialRoof,
    icon: drawResidentialIcon,
  },
  commercial: {
    floor: drawCommercialFloor,
    roof: drawCommercialRoof,
    icon: drawCommercialIcon,
  },
  office: { floor: drawOfficeFloor, roof: drawOfficeRoof, icon: drawOfficeIcon },
  luxury: { floor: drawLuxuryFloor, roof: drawLuxuryRoof, icon: drawLuxuryIcon },
};

/**
 * Generates the whitebox floor pattern, roof top shape and icon textures for every tower type
 * (constitution Principle VII: types are never told apart by color alone). Drawn in white/gray so
 * a per-type tint still applies cleanly, and each pattern stays identifiable in grayscale.
 */
export function generateTypeArt(scene: Phaser.Scene): void {
  for (const type of TOWER_TYPES) {
    const drawers = DRAWERS[type];
    generate(scene, floorTextureKey(type), TYPE_ART_WIDTH, TYPE_ART_HEIGHT, drawers.floor);
    generate(scene, roofTextureKey(type), TYPE_ART_WIDTH, TYPE_ART_HEIGHT, drawers.roof);
    generate(scene, iconTextureKey(type), TYPE_ART_ICON_SIZE, TYPE_ART_ICON_SIZE, drawers.icon);
  }
}
