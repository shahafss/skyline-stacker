import type { SimConfig, TowerType } from '@skyline/sim';
import { TUNING_VERSION } from '@skyline/sim';
import {
  TuningPanelModel,
  listTuningFields,
  tuningFieldLabel,
  type TuningField,
} from './tuningPanelModel';

const TOWER_TYPES: readonly TowerType[] = ['residential', 'commercial', 'office', 'luxury'];

/**
 * Dev-only plain-DOM tuning panel (T084, FR-038; constitution Principle III v1.2.0 pre-Phase-3
 * exception). Loaded only via `import.meta.env.DEV` dynamic import, on key `T`. Its text is
 * inline and exempt from `strings.ts` (plan.md interpretations); it is never in production
 * builds ([scripts/check-prod-bundle.ts](../../../../scripts/check-prod-bundle.ts) enforces it).
 */
export class TuningPanel {
  private readonly model: TuningPanelModel;
  private readonly root: HTMLDivElement;
  private readonly overriddenLabel: HTMLSpanElement;
  private readonly errorLabel: HTMLDivElement;
  private readonly inputs = new Map<string, HTMLInputElement>();

  constructor(
    private readonly baseConfig: SimConfig,
    private readonly onApply: (config: SimConfig) => void,
  ) {
    this.model = new TuningPanelModel(baseConfig.tuning);

    this.root = document.createElement('div');
    this.root.id = 'skyline-tuning-panel';
    this.root.dataset.devTool = 'tuning-panel';
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      bottom: '0',
      width: '340px',
      overflowY: 'auto',
      background: 'rgba(17, 24, 39, 0.95)',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '12px',
      zIndex: '1000',
      boxSizing: 'border-box',
    } satisfies Partial<CSSStyleDeclaration>);

    const title = document.createElement('h2');
    title.textContent = 'Tuning panel';
    title.style.fontSize = '14px';
    title.style.margin = '0 0 4px 0';
    this.root.appendChild(title);

    this.overriddenLabel = document.createElement('span');
    this.overriddenLabel.style.color = '#facc15';
    this.overriddenLabel.style.display = 'block';
    this.overriddenLabel.style.marginBottom = '8px';
    this.root.appendChild(this.overriddenLabel);

    this.buildGroup(
      'Global',
      listTuningFields().filter((f) => f.scope === 'global'),
    );
    for (const type of TOWER_TYPES) {
      this.buildGroup(
        type,
        listTuningFields().filter((f) => f.scope === type),
      );
    }

    this.errorLabel = document.createElement('div');
    this.errorLabel.style.color = '#f87171';
    this.errorLabel.style.margin = '8px 0';
    this.root.appendChild(this.errorLabel);

    this.root.appendChild(this.buildButton('Apply & restart', this.handleApply));
    this.root.appendChild(this.buildButton('Reset to defaults', this.handleReset));
    this.root.appendChild(this.buildButton('Export JSON', this.handleExport));

    this.refreshOverriddenLabel();
    document.body.appendChild(this.root);
  }

  /** Removes the panel from the document. */
  destroy(): void {
    this.root.remove();
  }

  private buildGroup(title: string, fields: readonly TuningField[]): void {
    const fieldset = document.createElement('fieldset');
    fieldset.style.border = '1px solid #374151';
    fieldset.style.marginBottom = '8px';
    const legend = document.createElement('legend');
    legend.textContent = title;
    fieldset.appendChild(legend);

    for (const field of fields) {
      fieldset.appendChild(this.buildFieldRow(field));
    }
    this.root.appendChild(fieldset);
  }

  private buildFieldRow(field: TuningField): HTMLLabelElement {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';
    row.style.margin = '4px 0';

    const name = document.createElement('span');
    name.textContent = tuningFieldLabel(field);
    row.appendChild(name);

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.value = this.model.getFieldText(field);
    input.style.width = '90px';
    input.addEventListener('change', () => {
      const error = this.model.setFieldText(field, input.value);
      this.errorLabel.textContent = error ?? '';
      if (error === null) {
        input.value = this.model.getFieldText(field);
      }
      this.refreshOverriddenLabel();
    });
    row.appendChild(input);

    this.inputs.set(tuningFieldLabel(field), input);
    return row;
  }

  private buildButton(label: string, handler: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.display = 'block';
    button.style.width = '100%';
    button.style.margin = '4px 0';
    button.addEventListener('click', handler);
    return button;
  }

  private refreshInputs(): void {
    for (const field of listTuningFields()) {
      const input = this.inputs.get(tuningFieldLabel(field));
      if (input) {
        input.value = this.model.getFieldText(field);
      }
    }
  }

  private refreshOverriddenLabel(): void {
    this.overriddenLabel.textContent = this.model.isOverridden ? 'OVERRIDDEN' : '';
  }

  private readonly handleApply = (): void => {
    const result = this.model.apply(this.baseConfig);
    if (result.ok) {
      this.errorLabel.textContent = '';
      this.onApply(result.config);
    } else {
      this.errorLabel.textContent = result.error;
    }
  };

  private readonly handleReset = (): void => {
    this.model.reset();
    this.refreshInputs();
    this.refreshOverriddenLabel();
    this.errorLabel.textContent = '';
  };

  private readonly handleExport = (): void => {
    const json = this.model.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tuning-${TUNING_VERSION}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
}
