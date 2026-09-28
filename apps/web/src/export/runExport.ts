import type { TowerSim } from '@skyline/sim';
import { createRunExport } from '@skyline/sim';

/** A finished run ready to be saved: a filename and the JSON text to write into it. */
export interface RunDownload {
  filename: string;
  text: string;
}

/**
 * Builds the downloadable run export for `sim` (FR-041): filename `run-<type>-<seed>.json` and
 * the export's JSON text (`createRunExport(sim)`, contracts/run-export.schema.json). Returns
 * `null` before the run has a result, since `createRunExport` requires one.
 */
export function buildDownload(sim: TowerSim): RunDownload | null {
  if (sim.getResult() === null) {
    return null;
  }
  const config = sim.getConfig();
  const exported = createRunExport(sim);
  return {
    filename: `run-${config.type}-${String(config.seed)}.json`,
    text: `${JSON.stringify(exported, null, 2)}\n`,
  };
}

/**
 * Triggers a browser download of `download` via a `Blob` and a temporary `<a download>` element.
 * No network call is made (Principle VII).
 */
export function triggerDownload(download: RunDownload): void {
  const blob = new Blob([download.text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = download.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
