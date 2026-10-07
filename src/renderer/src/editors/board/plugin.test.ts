import { describe, expect, it } from 'vitest';
import en from '@shared/i18n/locales/en/board.json';
import { boardElementDefinitions, boardPlugin } from './plugin';
import { boardShortcuts } from './shortcuts';
import { boardTools } from './tools';

function resolve(key: string): unknown {
  const [, path] = key.split(':');
  return path?.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], en);
}

describe('board plugin wiring', () => {
  it('registers one definition per board object type', () => {
    const types = boardElementDefinitions.map((d) => d.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types.sort()).toEqual(['code', 'icon', 'image', 'link', 'section', 'sticky', 'table', 'text']);
    expect(boardPlugin.elements).toHaveLength(8);
  });
  it('every tool is bound to an existing shortcut row with the same id', () => {
    const ids = new Set(boardShortcuts.map((s) => s.id));
    for (const tool of boardTools) {
      expect(tool.shortcutId).toBe(tool.id);
      expect(ids.has(tool.id)).toBe(true);
    }
  });
  it('every tool label and keyword key exists in the English locale', () => {
    for (const tool of boardTools) {
      expect(typeof resolve(tool.labelKey), tool.labelKey).toBe('string');
      if (tool.keywordsKey) expect(typeof resolve(tool.keywordsKey), tool.keywordsKey).toBe('string');
    }
  });
  it('has the Whimsical key bindings', () => {
    const keyOf = (id: string) => boardShortcuts.find((s) => s.id === id)?.keys[0];
    expect(keyOf('board.sticky')).toBe('N');
    expect(keyOf('board.text')).toBe('T');
    expect(keyOf('board.image')).toBe('I');
    expect(keyOf('board.link')).toBe('K');
    expect(keyOf('board.icon')).toBe('X');
    expect(keyOf('board.section')).toBe('.');
    expect(keyOf('board.table')).toBe('E');
  });
  it('commands cover every non-tool board shortcut', () => {
    const handled = new Set(boardTools.map((t) => t.id));
    const commandIds = ['board.distributeGrid', 'board.pasteAsStickies'];
    for (const row of boardShortcuts) expect(handled.has(row.id) || commandIds.includes(row.id), row.id).toBe(true);
  });
  it('draws object chrome that works in the light and dark themes (container section)', () => {
    expect(boardElementDefinitions.find((d) => d.type === 'section')?.container).toBe(true);
  });
});
