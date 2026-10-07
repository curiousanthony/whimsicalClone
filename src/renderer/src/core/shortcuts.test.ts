import { describe, expect, it, vi } from 'vitest';
import { ShortcutRegistry, formatGesture } from './shortcuts';
import type { ShortcutDef } from './types';

function key(init: Partial<KeyboardEventInit> & { key: string; code?: string }, target?: EventTarget): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  if (target) Object.defineProperty(event, 'target', { value: target });
  return event;
}

const defs: ShortcutDef[] = [
  { id: 'flowchart.hexagon', keys: ['F'], scope: 'canvas.diagram', labelKey: 'x', group: 'diagram' },
  { id: 'wireframe.frames', keys: ['F'], scope: 'canvas.wireframe', labelKey: 'x', group: 'wireframe' },
  { id: 'board.sticky', keys: ['N'], scope: 'canvas', labelKey: 'x', group: 'sticky' },
  { id: 'canvas.bringToFront', keys: [']'], scope: 'canvas', labelKey: 'x', group: 'arrange' },
  { id: 'edit.undo', keys: ['Mod+Z'], scope: 'app', labelKey: 'x', group: 'edit', allowInTextInput: true },
];

describe('ShortcutRegistry', () => {
  it('resolves the same key per active scope', () => {
    const r = new ShortcutRegistry('mac');
    r.define(defs);
    const hexagon = vi.fn();
    const frames = vi.fn();
    r.bind([
      { id: 'flowchart.hexagon', run: hexagon },
      { id: 'wireframe.frames', run: frames },
    ]);
    r.setActiveScopes(['canvas', 'canvas.diagram']);
    expect(r.handleKeyDown(key({ key: 'f', code: 'KeyF' }))).toBe(true);
    r.setActiveScopes(['canvas', 'canvas.wireframe']);
    r.handleKeyDown(key({ key: 'f', code: 'KeyF' }));
    expect(hexagon).toHaveBeenCalledTimes(1);
    expect(frames).toHaveBeenCalledTimes(1);
  });

  it('ignores bare keys while typing but allows flagged ones', () => {
    const r = new ShortcutRegistry('mac');
    r.define(defs);
    const sticky = vi.fn();
    const undo = vi.fn();
    r.bind([
      { id: 'board.sticky', run: sticky },
      { id: 'edit.undo', run: undo },
    ]);
    r.setActiveScopes(['canvas']);
    const input = document.createElement('input');
    expect(r.handleKeyDown(key({ key: 'n', code: 'KeyN' }, input))).toBe(false);
    expect(r.handleKeyDown(key({ key: 'z', code: 'KeyZ', metaKey: true }, input))).toBe(true);
    expect(sticky).not.toHaveBeenCalled();
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('matches punctuation by physical key and skips unbound or disabled commands', () => {
    const r = new ShortcutRegistry('mac');
    r.define(defs);
    r.setActiveScopes(['canvas']);
    expect(r.handleKeyDown(key({ key: ']', code: 'BracketRight' }))).toBe(false);
    const run = vi.fn();
    const unbind = r.bind([{ id: 'canvas.bringToFront', run, isEnabled: () => false }]);
    expect(r.handleKeyDown(key({ key: ']', code: 'BracketRight' }))).toBe(false);
    unbind();
    r.bind([{ id: 'canvas.bringToFront', run }]);
    // AZERTY-like layout producing another character on the same physical key.
    expect(r.handleKeyDown(key({ key: '$', code: 'BracketRight' }))).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('gives the focused folder view priority over the canvas behind it', () => {
    const r = new ShortcutRegistry('mac');
    r.define([
      { id: 'canvas.delete', keys: ['Backspace'], scope: 'canvas', labelKey: 'x', group: 'edit' },
      { id: 'folder.delete', keys: ['Backspace'], scope: 'folderView', labelKey: 'x', group: 'folder' },
    ]);
    const canvasDelete = vi.fn();
    const folderDelete = vi.fn();
    r.bind([
      { id: 'canvas.delete', run: canvasDelete },
      { id: 'folder.delete', run: folderDelete },
    ]);
    r.setActiveScopes(['canvas', 'canvas.diagram', 'folderView']);
    r.handleKeyDown(key({ key: 'Backspace', code: 'Backspace' }));
    expect(folderDelete).toHaveBeenCalledTimes(1);
    expect(canvasDelete).not.toHaveBeenCalled();
  });

  it('formats combos and gestures for display', () => {
    const r = new ShortcutRegistry('mac');
    r.define([{ id: 'canvas.saveDefaultStyle', keys: ['Mod+Shift+D'], scope: 'canvas', labelKey: 'x', group: 'edit' }]);
    expect(r.format('canvas.saveDefaultStyle')).toBe('⇧⌘D');
    expect(r.accelerator('canvas.saveDefaultStyle')).toBe('CmdOrCtrl+Shift+D');
    expect(formatGesture('Space+Drag')).toBe('Space + Drag');
    expect(formatGesture('Mod+Click')).toBe('⌘ + Click');
  });
});
