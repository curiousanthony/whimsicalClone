/**
 * Export hooks. The shell's export dialog asks the editor of the active file for PNG / SVG
 * (canvas) output through an exporter the editor registers for its file. Markdown (docs) and
 * PDF (print) are handled by the shell itself.
 *
 * Until `EditorServices.registerExporter` is added to core/types (change request in the shell
 * report), the shell already passes `registerExporter` on the services object it gives every
 * editor, so editors can feature-detect it:
 *   (services as { registerExporter?: RegisterExporter }).registerExporter?.(exporter)
 */

import type { RelPath } from '@shared/ipc';
import type { Unregister } from '@renderer/core/types';

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'markdown';

export interface ExportOptions {
  /** PNG pixel ratio. */
  scale: 1 | 2;
  /** PNG/SVG: transparent background instead of the canvas colour. */
  transparent: boolean;
  /** Export only the current selection. */
  selectionOnly: boolean;
  /** Colour mode to render in. */
  theme: 'light' | 'dark';
}

export interface DocumentExporter {
  formats: readonly ExportFormat[];
  /** True when the editor has a selection (enables "Selection only"). */
  hasSelection?: () => boolean;
  /** PNG -> Blob or ArrayBuffer; SVG / Markdown -> string. */
  export: (format: ExportFormat, options: ExportOptions) => Promise<Blob | ArrayBuffer | string>;
}

export type RegisterExporter = (exporter: DocumentExporter) => Unregister;

const exporters = new Map<RelPath, DocumentExporter[]>();
const listeners = new Set<() => void>();

export function registerExporter(path: () => RelPath, exporter: DocumentExporter): Unregister {
  const key = path();
  const list = exporters.get(key) ?? [];
  list.push(exporter);
  exporters.set(key, list);
  listeners.forEach((l) => l());
  return () => {
    for (const [k, l] of exporters) {
      const i = l.indexOf(exporter);
      if (i >= 0) l.splice(i, 1);
      if (l.length === 0) exporters.delete(k);
    }
    listeners.forEach((l) => l());
  };
}

export function getExporter(path: RelPath): DocumentExporter | undefined {
  const list = exporters.get(path);
  return list?.[list.length - 1];
}

/** Re-keys exporters after a rename/move. */
export function rebaseExporters(from: RelPath, to: RelPath): void {
  for (const [key, list] of [...exporters]) {
    if (key === from || key.startsWith(`${from}/`)) {
      exporters.delete(key);
      exporters.set(`${to}${key.slice(from.length)}`, list);
    }
  }
}

export function subscribeExporters(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
