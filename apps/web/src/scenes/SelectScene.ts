import Phaser from 'phaser';
import type { SimConfig, TowerType } from '@skyline/sim';
import { DEFAULT_TUNING, cloneTuning } from '@skyline/sim';
import { floorTextureKey, iconTextureKey } from '../render/typeArt';
import { TYPE_COLORS } from '../render/renderConfig';
import { STRINGS } from '../strings';
import { randomSeed, type GameSceneData } from './GameScene';

interface SelectEntry {
  readonly mode: SimConfig['mode'];
  readonly type: TowerType;
  readonly label: string;
}

const ENTRIES: readonly SelectEntry[] = [
  { mode: 'city', type: 'residential', label: STRINGS.typeNames.residential },
  { mode: 'city', type: 'commercial', label: STRINGS.typeNames.commercial },
  { mode: 'city', type: 'office', label: STRINGS.typeNames.office },
  { mode: 'city', type: 'luxury', label: STRINGS.typeNames.luxury },
  { mode: 'quick', type: 'residential', label: STRINGS.quickPlay },
];

const ROW_HEIGHT = 96;
const FIRST_ROW_Y = 300;
const ROW_LEFT_X = 60;

/**
 * The run selector (contracts/controls.md, FR-040): shown at start and after every run ends.
 * Keyboard-navigable (Principle VII) with a visible focus ring, and pointer-clickable. All text
 * comes from `STRINGS`.
 */
export class SelectScene extends Phaser.Scene {
  private focusIndex = 0;
  private assist = false;
  private focusRing!: Phaser.GameObjects.Rectangle;
  private assistValueText!: Phaser.GameObjects.Text;

  constructor() {
    super('Select');
  }

  create(): void {
    const width = this.scale.width;

    this.add
      .text(width / 2, 120, STRINGS.selector.title, {
        color: '#ffffff',
        fontSize: '40px',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(width / 2, 170, STRINGS.selector.hint, {
        color: '#9ca3af',
        fontSize: '18px',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 0.5);

    this.assistValueText = this.add
      .text(width / 2, 210, this.assistLabel(), {
        color: '#facc15',
        fontSize: '18px',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 0.5);

    this.focusRing = this.add.rectangle(
      width / 2,
      this.rowY(0),
      width - 80,
      ROW_HEIGHT - 12,
      0x000000,
      0,
    );
    this.focusRing.setStrokeStyle(3, 0xffffff, 1);
    this.focusRing.setDepth(10);

    ENTRIES.forEach((entry, index) => {
      this.createRow(entry, index);
    });

    this.input.keyboard?.on('keydown', this.handleKeyDown);
    this.updateFocusRing();
  }

  private rowY(index: number): number {
    return FIRST_ROW_Y + index * ROW_HEIGHT;
  }

  private assistLabel(): string {
    return this.assist ? STRINGS.selector.assistOn : STRINGS.selector.assistOff;
  }

  private createRow(entry: SelectEntry, index: number): void {
    const y = this.rowY(index);
    const color = TYPE_COLORS[entry.type];

    this.add.rectangle(ROW_LEFT_X + 12, y, 24, 48, color, 1);

    const pattern = this.add.image(ROW_LEFT_X + 80, y, floorTextureKey(entry.type));
    pattern.setTint(color);
    pattern.setDisplaySize(72, 36);

    const icon = this.add.image(ROW_LEFT_X + 160, y, iconTextureKey(entry.type));
    icon.setDisplaySize(40, 40);

    const label = this.add.text(ROW_LEFT_X + 200, y, entry.label, {
      color: '#ffffff',
      fontSize: '26px',
      fontFamily: 'monospace',
    });
    label.setOrigin(0, 0.5);

    const hitArea = this.add.rectangle(
      this.scale.width / 2,
      y,
      this.scale.width - 80,
      ROW_HEIGHT,
      0x000000,
      0,
    );
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => {
      this.focusIndex = index;
      this.updateFocusRing();
      this.start(entry);
    });
  }

  private updateFocusRing(): void {
    this.focusRing.y = this.rowY(this.focusIndex);
  }

  private moveFocus(delta: number): void {
    const count = ENTRIES.length;
    this.focusIndex = (this.focusIndex + delta + count) % count;
    this.updateFocusRing();
  }

  private toggleAssist(): void {
    this.assist = !this.assist;
    this.assistValueText.setText(this.assistLabel());
  }

  private start(entry: SelectEntry): void {
    const config: SimConfig = {
      type: entry.type,
      mode: entry.mode,
      seed: randomSeed(),
      assist: this.assist,
      tuning: cloneTuning(DEFAULT_TUNING),
    };
    this.scene.start('Game', { config } satisfies GameSceneData);
  }

  private startIndex(index: number): void {
    const entry = ENTRIES[index];
    if (entry) {
      this.focusIndex = index;
      this.updateFocusRing();
      this.start(entry);
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case '1':
        this.startIndex(0);
        break;
      case '2':
        this.startIndex(1);
        break;
      case '3':
        this.startIndex(2);
        break;
      case '4':
        this.startIndex(3);
        break;
      case '5':
      case 'q':
      case 'Q':
        this.startIndex(4);
        break;
      case 'ArrowUp':
        this.moveFocus(-1);
        break;
      case 'ArrowDown':
        this.moveFocus(1);
        break;
      case 'Enter':
        this.startIndex(this.focusIndex);
        break;
      case 'a':
      case 'A':
        this.toggleAssist();
        break;
      default:
        break;
    }
  };
}
