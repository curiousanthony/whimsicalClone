/**
 * Shell-side shortcut registry behaviour: tab-active gating of editor handlers, scope
 * switching for the sidebar / folder views and overlays, menu and command-menu dispatch,
 * shell fallbacks under stacked editor bindings, and the real shell table.
 */

import { describe, expect, it, vi } from 'vitest';
import { ShortcutRegistry } from '@renderer/core/shortcuts';
import type { ScopeId, ShortcutDef } from '@renderer/core/types';
import { allShortcutDefs } from '@renderer/app/editors';
import { TabBindings } from './editorHost/tabBindings';
import { computeScopes } from './state/scopes';
import { shellShortcuts } from './shortcuts';

function key(init: Partial<KeyboardEventInit> & { key: string; code?: string }, target?: EventTarget): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  if (target) Object.defineProperty(event, 'target', { value: target });
  return event;
}

const defs: ShortcutDef[] = [
  { id: 'edit.undo', keys: ['Mod+Z'], scope: 'app', labelKey: 'x', group: 'edit', allowInTextInput: true },
  { id: 'flowchart.rectangle', keys: ['R'], scope: 'canvas.diagram', labelKey: 'x', group: 'diagram' },
  { id: 'folder.delete', keys: ['Backspace'], scope: 'folderView', labelKey: 'x', group: 'folder' },
  { id: 'canvas.delete', keys: ['Backspace'], scope: 'canvas', labelKey: 'x', group: 'edit' },
  { id: 'folder.listView', keys: ['L'], scope: 'folderView', labelKey: 'x', group: 'folder' },
  { id: 'flowchart.line', keys: ['L'], scope: 'canvas.diagram', labelKey: 'x', group: 'diagram' },
];

describe('TabBindings', () => {
  it('binds editor handlers only while the tab is active', () => {
    const registry = new ShortcutRegistry('mac');
    registry.define(defs);
    registry.setActiveScopes(['canvas', 'canvas.diagram']);
    const tabA = new TabBindings(registry);
    const tabB = new TabBindings(registry);
    const rectA = vi.fn();
    const rectB = vi.fn();
    tabA.register([{ id: 'flowchart.rectangle', run: rectA }]);
    tabB.register([{ id: 'flowchart.rectangle', run: rectB }]);

    expect(registry.handleKeyDown(key({ key: 'r', code: 'KeyR' }))).toBe(false);
    tabA.setActive(true);
    registry.handleKeyDown(key({ key: 'r', code: 'KeyR' }));
    expect(rectA).toHaveBeenCalledTimes(1);

    // Switching tabs: the inactive (still mounted) tab must not shadow the active one.
    tabA.setActive(false);
    tabB.setActive(true);
    registry.handleKeyDown(key({ key: 'r', code: 'KeyR' }));
    expect(rectB).toHaveBeenCalledTimes(1);
    expect(rectA).toHaveBeenCalledTimes(1);
  });

  it('stacks editor bindings above shell fallbacks and restores them on deactivate', () => {
    const registry = new ShortcutRegistry('mac');
    registry.define(defs);
    const shellUndo = vi.fn();
    const docsUndo = vi.fn();
    registry.bind([{ id: 'edit.undo', run: shellUndo }]);
    const docs = new TabBindings(registry);
    docs.register([{ id: 'edit.undo', run: docsUndo }]);
    docs.setActive(true);
    registry.handleKeyDown(key({ key: 'z', code: 'KeyZ', metaKey: true }));
    expect(docsUndo).toHaveBeenCalledTimes(1);
    docs.setActive(false);
    registry.handleKeyDown(key({ key: 'z', code: 'KeyZ', metaKey: true }));
    expect(shellUndo).toHaveBeenCalledTimes(1);
  });

  it('registering while active binds immediately and unregister unbinds', () => {
    const registry = new ShortcutRegistry('mac');
    registry.define(defs);
    registry.setActiveScopes(['canvas', 'canvas.diagram']);
    const tab = new TabBindings(registry);
    tab.setActive(true);
    const run = vi.fn();
    const off = tab.register([{ id: 'flowchart.rectangle', run }]);
    expect(registry.isBound('flowchart.rectangle')).toBe(true);
    off();
    expect(registry.isBound('flowchart.rectangle')).toBe(false);
  });

  it('reports scopes of the active tab only', () => {
    const changes: (readonly ScopeId[])[] = [];
    const tab = new TabBindings(new ShortcutRegistry('mac'), (s) => changes.push(s));
    tab.setScopes(['canvas', 'canvas.diagram']);
    expect(changes).toEqual([]);
    tab.setActive(true);
    expect(changes).toEqual([['canvas', 'canvas.diagram']]);
    tab.setScopes(['canvas', 'canvas.wireframe']);
    expect(changes[1]).toEqual(['canvas', 'canvas.wireframe']);
  });
});

describe('scope switching', () => {
  it('suspends editor scopes while the sidebar / folder view has focus, restores after', () => {
    const editor: ScopeId[] = ['canvas', 'canvas.diagram'];
    expect(computeScopes(editor, false, false)).toEqual(editor);
    expect(computeScopes(editor, true, false)).toEqual(['folderView']);
    expect(computeScopes(editor, false, true)).toEqual([]);
    expect(computeScopes(editor, false, false)).toEqual(editor);
  });

  it('routes the same key to the folder view or the canvas depending on focus', () => {
    const registry = new ShortcutRegistry('mac');
    registry.define(defs);
    const trashFiles = vi.fn();
    const deleteShapes = vi.fn();
    const listView = vi.fn();
    const lineShape = vi.fn();
    registry.bind([
      { id: 'folder.delete', run: trashFiles },
      { id: 'canvas.delete', run: deleteShapes },
      { id: 'folder.listView', run: listView },
      { id: 'flowchart.line', run: lineShape },
    ]);
    const editor: ScopeId[] = ['canvas', 'canvas.diagram'];

    registry.setActiveScopes(computeScopes(editor, true, false));
    registry.handleKeyDown(key({ key: 'Backspace', code: 'Backspace' }));
    registry.handleKeyDown(key({ key: 'l', code: 'KeyL' }));
    expect(trashFiles).toHaveBeenCalledTimes(1);
    expect(listView).toHaveBeenCalledTimes(1);
    expect(deleteShapes).not.toHaveBeenCalled();

    registry.setActiveScopes(computeScopes(editor, false, false));
    registry.handleKeyDown(key({ key: 'Backspace', code: 'Backspace' }));
    registry.handleKeyDown(key({ key: 'l', code: 'KeyL' }));
    expect(deleteShapes).toHaveBeenCalledTimes(1);
    expect(lineShape).toHaveBeenCalledTimes(1);

    // Modal overlay open: bare canvas keys are inert, Cmd shortcuts still work.
    registry.setActiveScopes(computeScopes(editor, false, true));
    expect(registry.handleKeyDown(key({ key: 'l', code: 'KeyL' }))).toBe(false);
  });

  it('runs commands from the native menu and the command menu regardless of key scopes', () => {
    const registry = new ShortcutRegistry('mac');
    registry.define(defs);
    const run = vi.fn();
    registry.bind([{ id: 'flowchart.rectangle', run }]);
    registry.setActiveScopes([]);
    expect(registry.run('flowchart.rectangle', { source: 'menu' })).toBe(true);
    expect(registry.run('flowchart.rectangle', { source: 'commandMenu' })).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
    expect(registry.run('unknown.command', { source: 'menu' })).toBe(false);
  });

  it('lets Cmd shortcuts through text fields but not bare keys', () => {
    const registry = new ShortcutRegistry('mac');
    registry.define(defs);
    registry.setActiveScopes(['canvas', 'canvas.diagram']);
    const undo = vi.fn();
    const rect = vi.fn();
    registry.bind([
      { id: 'edit.undo', run: undo },
      { id: 'flowchart.rectangle', run: rect },
    ]);
    const input = document.createElement('input');
    registry.handleKeyDown(key({ key: 'z', code: 'KeyZ', metaKey: true }, input));
    registry.handleKeyDown(key({ key: 'r', code: 'KeyR' }, input));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(rect).not.toHaveBeenCalled();
  });
});

describe('shell shortcut table', () => {
  it('is part of the registered tables with unique ids', () => {
    const ids = allShortcutDefs.map((d) => d.id);
    for (const def of shellShortcuts) expect(ids).toContain(def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares the Whimsical app shortcuts', () => {
    const registry = new ShortcutRegistry('mac');
    registry.define(allShortcutDefs);
    expect(registry.format('app.commandMenu')).toBe('⌘K');
    expect(registry.format('app.newBoard')).toBe('⌥⌘N');
    expect(registry.format('app.searchWorkspace')).toBe('⌘J');
    expect(registry.format('app.toggleSidebar')).toBe('⌘E');
    expect(registry.format('tab.close')).toBe('⌘W');
    expect(registry.accelerator('edit.redo')).toBe('CmdOrCtrl+Shift+Z');
  });

  it('fires app shortcuts from any scope, including while typing', () => {
    const registry = new ShortcutRegistry('mac');
    registry.define(allShortcutDefs);
    const open = vi.fn();
    registry.bind([{ id: 'app.commandMenu', run: open }]);
    registry.setActiveScopes(['folderView']);
    const textarea = document.createElement('textarea');
    expect(registry.handleKeyDown(key({ key: 'k', code: 'KeyK', metaKey: true }, textarea))).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
