/**
 * Integrity tests for the frozen registries and every module's shortcut table.
 * Agents: keep these green; they catch duplicate ids, unparseable combos, missing i18n
 * labels, unknown lucide icon names and key collisions inside one scope.
 */

import * as lucide from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { formatCombo, parseCombo } from '@shared/keys';
import { FILE_KINDS } from '@shared/fileKinds';
import { ShortcutRegistry } from '@renderer/core/shortcuts';
import { i18n } from '@renderer/i18n';
import { allShortcutDefs, canvasPlugins, editorRegistry } from './editors';

describe('editor registry', () => {
  it('maps every file kind extension to an editor', () => {
    for (const info of FILE_KINDS) {
      expect(editorRegistry.forPath(`folder/Some name${info.extension}`)?.kind).toBe(info.kind);
    }
    expect(editorRegistry.forPath('notes/readme.markdown')?.kind).toBe('doc');
    expect(editorRegistry.forPath('image.png')).toBeUndefined();
  });

  it('round-trips an empty document for every editor', () => {
    for (const editor of editorRegistry.all) {
      const empty = editor.createEmpty();
      expect(editor.parse(editor.serialize(empty), `x${editor.extensions[0]}`)).toEqual(empty);
    }
  });

  it('declares one canvas plugin per canvas module', () => {
    expect(canvasPlugins.map((p) => p.id).sort()).toEqual(['board', 'canvas', 'draw', 'flowchart', 'mindmap', 'wireframe']);
  });
});

describe('shortcut tables', () => {
  it('register without duplicate ids or invalid combos', () => {
    const registry = new ShortcutRegistry('mac');
    expect(() => registry.define(allShortcutDefs)).not.toThrow();
  });

  it('have an English label for every command', () => {
    const missing = allShortcutDefs.filter((d) => !i18n.exists(d.labelKey)).map((d) => `${d.id} -> ${d.labelKey}`);
    expect(missing).toEqual([]);
  });

  it('reference existing lucide-react icons', () => {
    const icons = lucide as unknown as Record<string, unknown>;
    const names = [
      ...allShortcutDefs.map((d) => d.icon),
      ...editorRegistry.all.map((e) => e.icon),
      ...canvasPlugins.flatMap((p) => p.tools.map((t) => t.icon)),
    ].filter((n): n is string => !!n);
    const unknown = [...new Set(names)].filter((n) => !icons[n]);
    expect(unknown).toEqual([]);
  });

  it('never bind the same combo twice in one scope (registry-dispatched)', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const def of allShortcutDefs) {
      if (def.dispatch === 'native') continue;
      for (const key of def.keys) {
        const normalised = `${def.scope}|${formatCombo(parseCombo(key))}`;
        const other = seen.get(normalised);
        if (other && other !== def.id) clashes.push(`${normalised}: ${other} vs ${def.id}`);
        seen.set(normalised, def.id);
      }
    }
    expect(clashes).toEqual([]);
  });
});
