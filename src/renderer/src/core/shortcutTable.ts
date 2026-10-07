import type { Namespace } from '@shared/i18n/resources';
import type { ShortcutDef } from './types';

export type ShortcutRow = Omit<ShortcutDef, 'labelKey'> & { labelKey?: string };

/**
 * Builds a module shortcut table. `labelKey` defaults to "<ns>:commands.<id without its
 * first segment>", e.g. id "canvas.zoomIn" in ns "canvas" -> "canvas:commands.zoomIn".
 */
export function shortcutTable(ns: Namespace, rows: readonly ShortcutRow[]): ShortcutDef[] {
  return rows.map((row) => {
    const local = row.id.split('.').slice(1).join('.');
    return { ...row, labelKey: row.labelKey ?? `${ns}:commands.${local}` };
  });
}
