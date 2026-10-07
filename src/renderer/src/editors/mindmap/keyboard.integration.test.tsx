/**
 * Keyboard-only mapping on a mounted canvas (jsdom): the user's main workflow.
 *   M, Enter, type, Enter (sibling / first child), Tab (child), Esc, arrows, Cmd+Enter...
 */

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasCorePlugin, canvasShortcuts } from '@renderer/canvas';
import { CanvasEditor } from '@renderer/canvas/CanvasEditor';
import { CanvasPluginsContext } from '@renderer/core/canvasPlugins';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import { plainText } from '@renderer/core/richText';
import { ShortcutRegistry } from '@renderer/core/shortcuts';
import type { BoardDocument, ChangeOptions, EditorServices, MindMapNodeElement, ShortcutHandler } from '@renderer/core/types';
import { mindmapPlugin } from './plugin';
import { mindmapShortcuts } from './shortcuts';
import { buildTreeIndex, childIds } from './model';
import { laidOut } from './testkit';
import { sizeOf } from './actions';
import { relayoutDocument } from './layout';

afterEach(cleanup);

// ProseMirror measures ranges while scrolling the caret into view; jsdom has no layout.
const emptyRects = Object.assign([], { item: () => null });
Range.prototype.getClientRects = () => emptyRects as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
document.elementFromPoint = () => null;
// jsdom does not implement isContentEditable, which the shortcut registry relies on.
Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
  configurable: true,
  get(this: HTMLElement) {
    return this.getAttribute('contenteditable') === 'true';
  },
});

function setup(initial: BoardDocument) {
  const registry = new ShortcutRegistry('mac');
  registry.define(canvasShortcuts);
  registry.define(mindmapShortcuts);
  registry.define([{ id: 'edit.selectAll', keys: ['Mod+A'], scope: 'app', labelKey: 'x', group: 'edit', allowInTextInput: true }]);
  let content = initial;
  const changes: Array<{ doc: BoardDocument; options?: ChangeOptions }> = [];
  let scopes: readonly string[] = [];
  const services = {
    api: { prefs: { get: () => Promise.resolve({ invertZoom: false }), onChange: () => () => undefined } },
    openFile: vi.fn(),
    getViewState: () => ({ x: -400, y: -300, zoom: 1 }),
    setViewState: vi.fn(),
    notify: vi.fn(),
  } as unknown as EditorServices;
  const ui = (doc: BoardDocument) => (
    <CanvasPluginsContext.Provider value={[canvasCorePlugin, mindmapPlugin]}>
      <div style={{ width: 800, height: 600 }}>
        <CanvasEditor
          filePath="Test.wmind"
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
          preset={{ kind: 'mindmap', initialMode: 'diagram', initialTool: 'canvas.selectTool', toolbar: 'full' }}
        />
      </div>
    </CanvasPluginsContext.Provider>
  );
  const utils = render(ui(initial));
  // The shell listens on window (bubble phase) and feeds the registry.
  const listener = (e: KeyboardEvent) => void registry.handleKeyDown(e);
  window.addEventListener('keydown', listener);
  const canvas = utils.container.querySelector('.wc-canvas') as HTMLElement;
  canvas.focus();
  const nodes = () => content.elements.filter((e): e is MindMapNodeElement => e.type === 'mindmapNode');
  const editingId = () => utils.container.querySelector<HTMLElement>('.wc-mm-node.is-editing')?.dataset.mmId;
  const selectedIds = () => [...utils.container.querySelectorAll<HTMLElement>('.wc-mm-node.is-selected')].map((n) => n.dataset.mmId!);
  return {
    canvas,
    registry,
    changes,
    content: () => content,
    scopes: () => scopes,
    container: utils.container,
    nodes,
    editingId,
    selectedIds,
    byText: (text: string) => nodes().find((n) => plainText(n.text) === text),
    parentText: (text: string) => {
      const n = nodes().find((x) => plainText(x.text) === text);
      const p = nodes().find((x) => x.id === n?.treeParentId);
      return p ? plainText(p.text) : undefined;
    },
    texts: () => nodes().map((n) => plainText(n.text)),
    /** Non-text keys go through the registry like the shell does. */
    key(key: string, init: KeyboardEventInit = {}) {
      act(() => {
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
      });
    },
    dispose: () => window.removeEventListener('keydown', listener),
  };
}

const user = () => userEvent.setup({ document });

/** The text editor of the node being edited has mounted and holds the focus. */
const focused = () => waitFor(() => expect(document.activeElement?.classList.contains('ProseMirror')).toBe(true));

describe('keyboard-only mind mapping', () => {
  it('builds a map with M, Enter, typing, Enter, Tab and Escape', async () => {
    const t = setup(createEmptyBoard('mindmap', []));
    const u = user();
    t.key('m');
    t.key('Enter');
    expect(t.nodes()).toHaveLength(1);
    expect(t.scopes()).toContain('textEdit');
    await focused();
    await u.keyboard('Topic');
    await waitFor(() => expect(t.texts()).toEqual(['Topic']));

    // Enter on the root: first child, editing.
    await u.keyboard('{Enter}');
    expect(t.nodes()).toHaveLength(2);
    expect(t.editingId()).toBe(t.nodes()[1]!.id);
    await focused();
    await u.keyboard('Branch A');
    await waitFor(() => expect(t.texts()).toContain('Branch A'));

    // Enter: sibling (right below), Tab: child of that sibling.
    await u.keyboard('{Enter}');
    await focused();
    await u.keyboard('Branch B');
    await waitFor(() => expect(t.texts()).toContain('Branch B'));
    await u.keyboard('{Tab}');
    await focused();
    await u.keyboard('Leaf');
    await waitFor(() => expect(t.texts()).toContain('Leaf'));
    expect(t.texts()).toEqual(['Topic', 'Branch A', 'Branch B', 'Leaf']);
    expect(t.parentText('Leaf')).toBe('Branch B');
    expect(t.parentText('Branch B')).toBe('Topic');
    expect(t.editingId()).toBe(t.byText('Leaf')!.id);

    // Enter after Tab: sibling of the leaf at the same depth.
    await u.keyboard('{Enter}');
    await focused();
    await u.keyboard('Leaf 2');
    await waitFor(() => expect(t.texts()).toContain('Leaf 2'));
    expect(t.parentText('Leaf 2')).toBe('Branch B');

    // Escape: stop editing, node stays selected, mind-map scope active.
    await u.keyboard('{Escape}');
    expect(t.editingId()).toBeUndefined();
    expect(t.selectedIds()).toEqual([t.byText('Leaf 2')!.id]);
    expect(t.scopes()).toContain('canvas.mindmap');
    t.dispose();
  });

  it('navigates with the arrows and adds nodes from a selection', async () => {
    const doc = relayoutDocument(
      laidOut({ id: 'r', text: 'Root', children: [{ id: 'a', text: 'A', side: 'right', children: [{ id: 'a1', text: 'A1' }] }, { id: 'b', text: 'B', side: 'right' }] }),
      sizeOf,
    );
    const t = setup(doc);
    // Select the root by clicking it.
    const r = doc.elements.find((e) => e.id === 'r') as MindMapNodeElement;
    const at = { clientX: 400 + r.x + r.w / 2, clientY: 300 + r.y + r.h / 2 };
    act(() => {
      fireEvent.pointerDown(t.canvas, { ...at, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse' });
      fireEvent.pointerUp(t.canvas, { ...at, button: 0, buttons: 0, pointerId: 1, pointerType: 'mouse' });
    });
    expect(t.selectedIds()).toEqual(['r']);
    t.key('ArrowRight');
    expect(t.selectedIds()).toEqual(['a']);
    t.key('ArrowRight');
    expect(t.selectedIds()).toEqual(['a1']);
    t.key('ArrowLeft');
    t.key('ArrowDown');
    expect(t.selectedIds()).toEqual(['b']);
    t.key('ArrowUp');
    expect(t.selectedIds()).toEqual(['a']);
    t.key('Tab', { shiftKey: true });
    expect(t.selectedIds()).toEqual(['r']);

    // Tab on a selected node: a new child in edit mode; Escape on the empty node removes it.
    t.key('ArrowRight');
    t.key('Tab');
    expect(t.nodes()).toHaveLength(5);
    const created = t.editingId()!;
    expect(created).toBeDefined();
    expect(childIds(buildTreeIndex(t.content().elements), 'a')).toContain(created);
    const u = user();
    await u.keyboard('{Escape}');
    expect(t.nodes()).toHaveLength(4);
    expect(t.selectedIds()).toEqual(['a1']);

    // Enter on a selected node edits it, Cmd+Enter adds a sibling above, Alt+Enter a parent.
    t.key('Enter');
    expect(t.editingId()).toBe('a1');
    await u.keyboard('{Escape}');
    t.key('Enter', { metaKey: true });
    const above = t.editingId()!;
    expect(above).toBeDefined();
    expect(childIds(buildTreeIndex(t.content().elements), 'a')).toEqual([above, 'a1']);
    await focused();
    await u.keyboard('Before');
    await waitFor(() => expect(t.texts()).toContain('Before'));
    await u.keyboard('{Meta>}{Enter}{/Meta}');
    expect(t.texts()).toContain('Before');
    t.dispose();
  });

  it('deletes with the subtree, duplicates, collapses and moves branches from the keyboard', () => {
    const doc = relayoutDocument(
      laidOut({ id: 'r', text: 'Root', children: [{ id: 'a', text: 'A', side: 'right', children: [{ id: 'a1', text: 'A1' }, { id: 'a2', text: 'A2' }] }, { id: 'b', text: 'B', side: 'right' }] }),
      sizeOf,
    );
    const t = setup(doc);
    const click = (id: string) => {
      const n = t.content().elements.find((e) => e.id === id) as MindMapNodeElement;
      const at = { clientX: 400 + n.x + n.w / 2, clientY: 300 + n.y + n.h / 2 };
      act(() => {
        fireEvent.pointerDown(t.canvas, { ...at, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse' });
        fireEvent.pointerUp(t.canvas, { ...at, button: 0, buttons: 0, pointerId: 1, pointerType: 'mouse' });
      });
    };
    click('a');
    t.key('/', { metaKey: true, code: 'Slash' });
    expect(t.nodes().find((n) => n.id === 'a')?.collapsed).toBe(true);
    expect(t.nodes().find((n) => n.id === 'a1')).toMatchObject({ w: 0, h: 0 });
    t.key('/', { metaKey: true, code: 'Slash' });
    expect(t.nodes().find((n) => n.id === 'a')?.collapsed).toBeUndefined();
    expect(t.nodes().find((n) => n.id === 'a1')!.w).toBeGreaterThan(0);

    click('a2');
    t.key('ArrowUp', { metaKey: true, shiftKey: true });
    expect(childIds(buildTreeIndex(t.content().elements), 'a')).toEqual(['a2', 'a1']);

    click('a');
    t.key('d', { metaKey: true });
    expect(t.nodes().filter((n) => plainText(n.text) === 'A')).toHaveLength(2);
    expect(t.nodes()).toHaveLength(8);

    click('a');
    t.key('Backspace');
    // The copy of A (with its two children) stays; the original subtree is gone.
    expect(t.nodes()).toHaveLength(5);
    expect(t.content().elements.some((e) => e.id === 'a1')).toBe(false);
    t.dispose();
  });

  it('ends a list with Enter on an empty node and goes back up with Shift+Tab', async () => {
    const doc = relayoutDocument(laidOut({ id: 'r', text: 'Root', children: [{ id: 'a', text: 'A', side: 'right' }] }), sizeOf);
    const t = setup(doc);
    const u = user();
    const a = doc.elements.find((e) => e.id === 'a') as MindMapNodeElement;
    const at = { clientX: 400 + a.x + a.w / 2, clientY: 300 + a.y + a.h / 2 };
    act(() => {
      fireEvent.pointerDown(t.canvas, { ...at, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse' });
      fireEvent.pointerUp(t.canvas, { ...at, button: 0, buttons: 0, pointerId: 1, pointerType: 'mouse' });
    });
    t.key('Enter'); // edit A
    await focused();
    await u.keyboard('{Enter}'); // sibling below
    await focused();
    expect(t.nodes()).toHaveLength(3);
    await u.keyboard('{Enter}'); // empty: stop and discard, back on A
    await waitFor(() => expect(t.nodes()).toHaveLength(2));
    expect(t.editingId()).toBeUndefined();
    expect(t.selectedIds()).toEqual(['a']);

    t.key('Tab'); // child of A
    await focused();
    await u.keyboard('Deep');
    await waitFor(() => expect(t.texts()).toContain('Deep'));
    await u.keyboard('{Shift>}{Tab}{/Shift}'); // select parent
    await waitFor(() => expect(t.editingId()).toBeUndefined());
    expect(t.selectedIds()).toEqual(['a']);
    t.dispose();
  });

  it('re-parents a node dragged onto another node in one undo step', () => {
    const doc = relayoutDocument(
      laidOut({ id: 'r', text: 'Root', children: [{ id: 'a', text: 'A', side: 'right', children: [{ id: 'a1', text: 'A1' }] }, { id: 'b', text: 'B', side: 'right' }] }),
      sizeOf,
    );
    const t = setup(doc);
    const centre = (id: string) => {
      const n = doc.elements.find((e) => e.id === id) as MindMapNodeElement;
      return { x: 400 + n.x + n.w / 2, y: 300 + n.y + n.h / 2 };
    };
    const from = centre('b');
    const to = centre('a1');
    const ev = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', p: { x: number; y: number }) =>
      act(() => {
        fireEvent[type](t.canvas, { clientX: p.x, clientY: p.y, button: 0, buttons: type === 'pointerUp' ? 0 : 1, pointerId: 1, pointerType: 'mouse' });
      });
    ev('pointerDown', from);
    ev('pointerMove', { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
    ev('pointerMove', to);
    expect(t.changes).toHaveLength(0);
    ev('pointerUp', to);
    expect(t.changes).toHaveLength(1);
    expect(t.nodes().find((n) => n.id === 'b')?.treeParentId).toBe('a1');
    t.dispose();
  });

  it('moves the descendants and their branch lines live while the root is dragged', () => {
    const doc = relayoutDocument(laidOut({ id: 'r', text: 'Root', children: [{ id: 'a', text: 'A', side: 'right', children: [{ id: 'a1', text: 'A1' }] }] }), sizeOf);
    const t = setup(doc);
    const r = doc.elements.find((e) => e.id === 'r') as MindMapNodeElement;
    const a = doc.elements.find((e) => e.id === 'a') as MindMapNodeElement;
    const from = { x: 400 + r.x + r.w / 2, y: 300 + r.y + r.h / 2 };
    const ev = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', p: { x: number; y: number }) =>
      act(() => {
        fireEvent[type](t.canvas, { clientX: p.x, clientY: p.y, button: 0, buttons: type === 'pointerUp' ? 0 : 1, pointerId: 1, pointerType: 'mouse' });
      });
    ev('pointerDown', from);
    ev('pointerMove', { x: from.x + 40, y: from.y + 20 });
    ev('pointerMove', { x: from.x + 96, y: from.y + 48 });
    expect(t.changes).toHaveLength(0);
    // Mid-drag: only the root moved in the document, the child box is shifted by the same offset...
    const box = t.container.querySelector<HTMLElement>('[data-element-id="a"] .wc-mm-box')!;
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(box.style.transform);
    expect(m).not.toBeNull();
    const dx = Number(m![1]);
    const dy = Number(m![2]);
    expect(dx).toBeGreaterThan(0);
    // ...and the branch line still ends on the shifted child box.
    const paths = [...t.container.querySelectorAll<SVGPathElement>('.wc-mm-branch')];
    const toA = paths.find((p) => /^M[^C]*C[^,]*,[^ ]* [^,]*,[^ ]* ([\d.-]+),([\d.-]+)$/.test(p.getAttribute('d')!));
    expect(toA).toBeDefined();
    const end = /([\d.-]+),([\d.-]+)$/.exec(toA!.getAttribute('d')!)!;
    expect(Number(end[1])).toBeCloseTo(a.x + dx, 0);
    expect(Number(end[2])).toBeCloseTo(a.y + a.h / 2 + dy, 0);
    ev('pointerUp', { x: from.x + 96, y: from.y + 48 });
    expect(t.changes).toHaveLength(1);
    expect(box.style.transform).toBe('');
    expect(t.nodes().find((n) => n.id === 'a')!.x).toBeGreaterThan(a.x);
    t.dispose();
  });
});
