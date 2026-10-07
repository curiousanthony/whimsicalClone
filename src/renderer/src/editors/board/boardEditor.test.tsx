/** Mounted-engine tests of the board tools: keyboard-only creation of sticky notes and objects. */

import { useSyncExternalStore } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasCorePlugin, canvasShortcuts } from '@renderer/canvas';
// Deep import: tests mount the engine directly (the public entry only exposes the lazy plugin).
import { CanvasEditor } from '@renderer/canvas/CanvasEditor';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import { CanvasPluginsContext } from '@renderer/core/canvasPlugins';
import { ShortcutRegistry } from '@renderer/core/shortcuts';
import type { BoardDocument, BoardElement, EditorServices, ScopeId, ShortcutHandler } from '@renderer/core/types';
import { boardPlugin } from './plugin';
import { boardShortcuts } from './shortcuts';
import { createStickyElement } from './model';

afterEach(cleanup);

/**
 * Host stand-in: the document lives in an external store read with useSyncExternalStore, like
 * the shell's zustand store, so a commit and the engine's own store updates render together.
 */
function setup(initial: BoardDocument) {
  const registry = new ShortcutRegistry('mac');
  registry.define(canvasShortcuts);
  registry.define(boardShortcuts);
  registry.define([{ id: 'edit.selectAll', keys: ['Mod+A'], scope: 'app', labelKey: 'x', group: 'edit', allowInTextInput: true }]);
  let content = initial;
  const listeners = new Set<() => void>();
  let scopes: readonly ScopeId[] = [];
  const services = {
    api: { prefs: { get: () => Promise.resolve({ invertZoom: false }), onChange: () => () => undefined } },
    openFile: vi.fn(),
    getViewState: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewState: vi.fn(),
    notify: vi.fn(),
  } as unknown as EditorServices;
  const plugins = [canvasCorePlugin, boardPlugin];
  function Host(): JSX.Element {
    const doc = useSyncExternalStore(
      (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      () => content,
    );
    return (
      <CanvasPluginsContext.Provider value={plugins}>
        <div style={{ width: 800, height: 600 }}>
          <CanvasEditor
            filePath="Test.wboard"
            title="Test"
            content={doc}
            onChange={(next) => {
              content = next;
              listeners.forEach((fn) => fn());
            }}
            registerShortcuts={(handlers: readonly ShortcutHandler[]) => registry.bind(handlers)}
            setScopes={(s) => {
              scopes = s;
              registry.setActiveScopes(s);
            }}
            isActive
            services={services}
            preset={{ kind: 'board', initialMode: 'diagram', initialTool: 'canvas.selectTool', toolbar: 'full' }}
          />
        </div>
      </CanvasPluginsContext.Provider>
    );
  }
  render(<Host />);
  return {
    registry,
    content: () => content,
    types: () => content.elements.map((e: BoardElement) => e.type),
    scopes: () => scopes,
    key(key: string, init: KeyboardEventInit = {}) {
      act(() => {
        registry.handleKeyDown(new KeyboardEvent('keydown', { key, code: key === '.' ? 'Period' : undefined, bubbles: true, cancelable: true, ...init }));
      });
    },
  };
}

describe('board keyboard creation', () => {
  it('N then Enter drops a sticky note and starts editing it', () => {
    const t = setup(createEmptyBoard('board', []));
    t.key('n');
    t.key('Enter');
    expect(t.types()).toEqual(['sticky']);
    expect(t.scopes()).toContain('textEdit');
    const sticky = t.content().elements[0]!;
    expect(sticky).toMatchObject({ type: 'sticky', w: 168, h: 168, autoSize: true });
  });

  it('Alt+Arrow clones a selected sticky note to the side without a connector', () => {
    const t = setup(createEmptyBoard('board', []));
    t.key('n');
    t.key('Enter');
    t.key('Escape');
    t.key('ArrowRight', { altKey: true });
    expect(t.types()).toEqual(['sticky', 'sticky']);
    const [a, b] = t.content().elements;
    expect((b as { x: number }).x).toBeGreaterThan((a as { x: number }).x + 168);
    expect((b as { y: number }).y).toBe((a as { y: number }).y);
  });

  it.each([
    ['t', 'text'],
    ['k', 'link'],
    ['e', 'table'],
    ['.', 'section'],
  ])('%s then Enter creates a %s', (key, type) => {
    const t = setup(createEmptyBoard('board', []));
    t.key(key);
    t.key('Enter');
    expect(t.types()).toEqual([type]);
  });

  it('Delete removes the created sticky', () => {
    const t = setup(createEmptyBoard('board', []));
    t.key('n');
    t.key('Enter');
    t.key('Escape');
    t.key('Backspace');
    expect(t.types()).toEqual([]);
  });

  it('Distribute as grid rearranges selected sticky notes', () => {
    const notes = [0, 1, 2, 3].map((i) => createStickyElement({ id: `s${i}`, x: i * 500, y: 0 }));
    const t = setup(createEmptyBoard('board', notes));
    t.key('a', { metaKey: true });
    act(() => {
      t.registry.run('board.distributeGrid', { source: 'menu' });
    });
    const xs = t.content().elements.map((e) => (e as { x: number }).x);
    const ys = t.content().elements.map((e) => (e as { y: number }).y);
    expect(xs).toEqual([0, 192, 0, 192]);
    expect(ys).toEqual([0, 0, 192, 192]);
  });
});
