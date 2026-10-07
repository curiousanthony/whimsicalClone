/**
 * Smoke tests of the mounted engine (jsdom): selection by click, drag = one undo step,
 * Escape cancels, keyboard commands through the shortcut registry, scopes.
 */

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasPluginsContext } from '@renderer/core/canvasPlugins';
import { ShortcutRegistry } from '@renderer/core/shortcuts';
import type { BoardDocument, ChangeOptions, EditorServices, ScopeId, ShapeElement, ShortcutHandler } from '@renderer/core/types';
import { CanvasEditor } from './CanvasEditor';
import { canvasCorePlugin } from './plugin';
import { canvasShortcuts } from './shortcuts';
import { testPlugin } from './testPlugin';
import { board, shape } from './testUtils';

afterEach(cleanup);

function setup(initial: BoardDocument) {
  const registry = new ShortcutRegistry('mac');
  registry.define(canvasShortcuts);
  registry.define([
    { id: 'edit.selectAll', keys: ['Mod+A'], scope: 'app', labelKey: 'x', group: 'edit', allowInTextInput: true },
    { id: 'test.rectangle', keys: ['R'], scope: 'canvas.diagram', labelKey: 'x', group: 'diagram' },
  ]);
  let content = initial;
  const changes: Array<{ doc: BoardDocument; options?: ChangeOptions }> = [];
  let scopes: readonly ScopeId[] = [];
  const services = {
    api: { prefs: { get: () => Promise.resolve({ invertZoom: false }), onChange: () => () => undefined } },
    openFile: vi.fn(),
    getViewState: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewState: vi.fn(),
    notify: vi.fn(),
  } as unknown as EditorServices;
  const ui = (doc: BoardDocument) => (
    <CanvasPluginsContext.Provider value={[canvasCorePlugin, testPlugin]}>
      <div style={{ width: 800, height: 600 }}>
        <CanvasEditor
          filePath="Test.wboard"
          title="Test"
          content={doc}
          onChange={(next, options) => {
            content = next;
            changes.push({ doc: next, options });
            utils.rerender(ui(next));
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
  const utils = render(ui(initial));
  const canvas = utils.container.querySelector('.wc-canvas') as HTMLElement;
  return {
    canvas,
    registry,
    changes,
    content: () => content,
    scopes: () => scopes,
    container: utils.container,
    key(key: string, init: KeyboardEventInit = {}) {
      act(() => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
        registry.handleKeyDown(event);
      });
    },
  };
}

const pointer = (el: HTMLElement, type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number, extra: object = {}) =>
  act(() => {
    fireEvent[type](el, { clientX: x, clientY: y, button: 0, buttons: type === 'pointerUp' ? 0 : 1, pointerId: 1, pointerType: 'mouse', ...extra });
  });

describe('CanvasEditor', () => {
  it('renders elements and reports the diagram scopes', () => {
    const t = setup(board([shape('a', 0, 0, 100, 50)]));
    expect(t.container.querySelector('[data-element-id="a"]')).not.toBeNull();
    expect(t.scopes()).toEqual(['canvas', 'canvas.diagram']);
  });

  it('selects on click and moves with one committed change', () => {
    const t = setup(board([shape('a', 0, 0, 96, 48)]));
    pointer(t.canvas, 'pointerDown', 10, 10);
    pointer(t.canvas, 'pointerMove', 40, 34);
    pointer(t.canvas, 'pointerMove', 70, 58);
    expect(t.changes).toHaveLength(0);
    pointer(t.canvas, 'pointerUp', 70, 58);
    expect(t.changes).toHaveLength(1);
    const moved = t.content().elements[0] as ShapeElement;
    // 60 / 48 px drag, snapped to the 12 px grid.
    expect(moved.x).toBe(60);
    expect(moved.y).toBe(48);
    expect(t.changes[0]!.options?.selection).toEqual(['a']);
  });

  it('cancels a drag with Escape', () => {
    const t = setup(board([shape('a', 0, 0, 96, 48)]));
    pointer(t.canvas, 'pointerDown', 10, 10);
    pointer(t.canvas, 'pointerMove', 80, 80);
    t.key('Escape');
    pointer(t.canvas, 'pointerUp', 80, 80);
    expect(t.changes).toHaveLength(0);
    expect((t.content().elements[0] as ShapeElement).x).toBe(0);
  });

  it('runs keyboard commands: select all, nudge, delete', () => {
    const t = setup(board([shape('a', 0, 0), shape('b', 200, 0)]));
    t.key('a', { metaKey: true });
    t.key('ArrowRight');
    expect((t.content().elements[0] as ShapeElement).x).toBe(12);
    expect((t.content().elements[1] as ShapeElement).x).toBe(212);
    t.key('Backspace');
    expect(t.content().elements).toHaveLength(0);
  });

  it('creates a connected copy with Alt+Arrow (quick add)', () => {
    const t = setup(board([shape('a', 0, 0, 168, 72)]));
    pointer(t.canvas, 'pointerDown', 10, 10);
    pointer(t.canvas, 'pointerUp', 10, 10);
    t.key('ArrowRight', { altKey: true });
    const els = t.content().elements;
    expect(els.map((e) => e.type)).toEqual(['shape', 'shape', 'connector']);
    expect((els[1] as ShapeElement).x).toBe(228);
    expect(t.scopes()).toContain('textEdit');
  });

  it('creates a flowchart with the keyboard only (R, Enter, type, Esc, Alt+Arrow)', () => {
    const t = setup(board([]));
    t.key('r');
    t.key('Enter');
    expect(t.content().elements).toHaveLength(1);
    expect(t.scopes()).toContain('textEdit');
    t.key('Escape');
    expect(t.scopes()).not.toContain('textEdit');
    t.key('ArrowRight', { altKey: true });
    const els = t.content().elements;
    expect(els.map((e) => e.type)).toEqual(['shape', 'shape', 'connector']);
    expect(t.scopes()).toContain('textEdit');
    t.key('Escape');
    t.key('ArrowDown', { altKey: true });
    expect(t.content().elements).toHaveLength(5);
  });

  it('marquee-selects and groups with Cmd+G', () => {
    const t = setup(board([shape('a', 0, 0), shape('b', 200, 0), shape('c', 0, 300)]));
    pointer(t.canvas, 'pointerDown', -20, -20);
    pointer(t.canvas, 'pointerMove', 350, 100);
    pointer(t.canvas, 'pointerUp', 350, 100);
    t.key('g', { metaKey: true });
    const [a, b, c] = t.content().elements;
    expect(a!.groupId).toBeDefined();
    expect(a!.groupId).toBe(b!.groupId);
    expect(c!.groupId).toBeUndefined();
  });
});
