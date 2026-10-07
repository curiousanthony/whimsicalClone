/**
 * Keyboard-shortcut help sheet model (SPEC 6.5): rows grouped by ShortcutGroup, filtered to
 * the scopes of the current context, direction families (…Up/Down/Left/Right) merged into
 * one row shown with ↑↓←→. Pure, unit tested.
 */

import { formatCombo } from '@shared/keys';
import type { ScopeId, ShortcutDef, ShortcutGroup } from '@renderer/core/types';

export type HelpContext = 'canvas' | 'draw' | 'docs' | 'folder' | 'none';

export interface HelpRow {
  id: string;
  label: string;
  /** Alternative key presentations ("⌘K", "⇧ + Drag"). */
  keys: string[];
  extension: boolean;
  scope: ScopeId;
}

export interface HelpGroup {
  group: ShortcutGroup;
  rows: HelpRow[];
}

export const GROUP_ORDER: readonly ShortcutGroup[] = [
  'general',
  'file',
  'tabs',
  'edit',
  'tools',
  'diagram',
  'sticky',
  'connectors',
  'quickAdd',
  'mindmap',
  'wireframe',
  'freehand',
  'selection',
  'arrange',
  'zoom',
  'text',
  'docs',
  'markdown',
  'docsBlocks',
  'docsTables',
  'folder',
];

/** Scopes worth listing for a context (app is always included). */
export function scopesForContext(context: HelpContext): ScopeId[] | null {
  switch (context) {
    case 'canvas':
      return ['app', 'canvas', 'canvas.diagram', 'canvas.wireframe', 'canvas.freehand', 'canvas.mindmap', 'textEdit'];
    case 'draw':
      return ['app', 'canvas', 'canvas.freehand', 'textEdit'];
    case 'docs':
      return ['app', 'docs'];
    case 'folder':
      return ['app', 'folderView'];
    default:
      return null;
  }
}

const DIRECTION = /^(.*?)(Up|Down|Left|Right)([A-Z][A-Za-z]*)?$/;
const ARROWS = ['↑', '↓', '←', '→'];

interface HelpOptions {
  translate: (key: string) => string;
  /** Formats a gesture string ("Space+Drag"). */
  formatGesture: (gesture: string) => string;
  /** Scopes to keep; null keeps every scope. */
  scopes: readonly ScopeId[] | null;
  query?: string;
}

function keysOf(def: ShortcutDef, formatGesture: (g: string) => string): string[] {
  return [...def.keys.map((k) => formatCombo(k)), ...(def.gestures ?? []).map(formatGesture)];
}

/** Merges four direction rows into one when their keys only differ by the arrow. */
function mergeDirections(defs: ShortcutDef[], options: HelpOptions): Map<string, HelpRow> {
  const merged = new Map<string, HelpRow>();
  const families = new Map<string, Map<string, ShortcutDef>>();
  for (const def of defs) {
    const match = DIRECTION.exec(def.id);
    if (!match) continue;
    const key = `${def.scope}|${match[1]}*${match[3] ?? ''}`;
    const family = families.get(key) ?? new Map<string, ShortcutDef>();
    family.set(match[2]!, def);
    families.set(key, family);
  }
  for (const family of families.values()) {
    if (family.size !== 4) continue;
    const up = family.get('Up')!;
    const ordered = ['Up', 'Down', 'Left', 'Right'].map((d) => family.get(d)!);
    const primaries = ordered.map((d) => (d.keys[0] ? formatCombo(d.keys[0]) : ''));
    const prefixes = primaries.map((p, i) => (p.endsWith(ARROWS[i]!) ? p.slice(0, -1) : null));
    const shared = prefixes.every((p) => p !== null && p === prefixes[0]);
    const row: HelpRow = {
      id: up.id,
      label: options.translate(up.labelKey),
      keys: shared ? [`${prefixes[0]}${ARROWS.join('')}`] : primaries.filter(Boolean),
      extension: !!up.extension,
      scope: up.scope,
    };
    merged.set(up.id, row);
    for (const d of ordered) if (d !== up) merged.set(d.id, { ...row, id: '' });
  }
  return merged;
}

export function buildHelpGroups(defs: readonly ShortcutDef[], options: HelpOptions): HelpGroup[] {
  const inScope = defs.filter(
    (d) =>
      (d.keys.length > 0 || (d.gestures?.length ?? 0) > 0) && (!options.scopes || options.scopes.includes(d.scope)),
  );
  // Families are detected before hiding: tables often hide the Down/Left/Right aliases.
  const merged = mergeDirections(inScope, options);
  const visible = inScope.filter((d) => !d.hidden || merged.has(d.id));
  const query = options.query?.trim().toLowerCase() ?? '';
  const byGroup = new Map<ShortcutGroup, HelpRow[]>();
  for (const def of visible) {
    const mergedRow = merged.get(def.id);
    if (mergedRow && mergedRow.id === '') continue; // folded into its family's Up row
    const row: HelpRow = mergedRow ?? {
      id: def.id,
      label: options.translate(def.labelKey),
      keys: keysOf(def, options.formatGesture),
      extension: !!def.extension,
      scope: def.scope,
    };
    if (query && !row.label.toLowerCase().includes(query) && !row.keys.some((k) => k.toLowerCase().includes(query)))
      continue;
    const list = byGroup.get(def.group) ?? [];
    list.push(row);
    byGroup.set(def.group, list);
  }
  const groups = [...byGroup.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return groups.map((group) => ({ group, rows: byGroup.get(group) ?? [] }));
}
