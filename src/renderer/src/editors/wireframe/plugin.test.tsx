/**
 * Integration tests of the wireframe plugin mounted on the real canvas engine (jsdom): keyboard
 * creation, launchers, annotations, lines, rendering of every component, file round trip.
 */

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasCorePlugin, canvasShortcuts, createCanvasEditorPlugin } from '@renderer/canvas';
import { CanvasEditor } from '@renderer/canvas/CanvasEditor';
import { createEmptyBoard, parseBoard, serializeBoard } from '@renderer/core/boardFormat';
import { CanvasPluginsContext } from '@renderer/core/canvasPlugins';
import { plainText } from '@renderer/core/richText';
import { ShortcutRegistry } from '@renderer/core/shortcuts';
import type {
  AnnotationElement,
  BoardDocument,
  BoardElement,
  ChangeOptions,
  EditorServices,
  FrameElement,
  ScopeId,
  ShortcutHandler,
  WireElement,
} from '@renderer/core/types';
import { translateKey } from '@renderer/i18n';
import { annotationDefinition, frameDefinition, wireDefinition } from './definitions';
import { WIRE_KINDS } from './registry';
import { createFrame, createWire } from './model';
import { wireframePlugin } from './plugin';
import { wireframeEditor } from './index';

afterEach(cleanup);

function setup(initial: BoardDocument) {
  const registry = new ShortcutRegistry('mac');
  registry.define(canvasShortcuts);
  registry.define(wireframePlugin.shortcuts);
  registry.define([
    { id: 'edit.selectAll', keys: ['Mod+A'], scope: 'app', labelKey: 'x', group: 'edit', allowInTextInput: true },
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
    <CanvasPluginsContext.Provider value={[canvasCorePlugin, wireframePlugin]}>
      <div style={{ width: 800, height: 600 }}>
        <CanvasEditor
          filePath="Test.wwire"
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
          preset={{ kind: 'wireframe', initialMode: 'wireframe', initialTool: 'canvas.selectTool', toolbar: 'full' }}
        />
      </div>
    </CanvasPluginsContext.Provider>
  );
  const utils = render(ui(initial));
  const canvas = utils.container.querySelector('.wc-canvas') as HTMLElement;
  return {
    canvas,
    changes,
    content: () => content,
    scopes: () => scopes,
    container: utils.container,
    key(key: string, init: KeyboardEventInit = {}) {
      act(() => {
        registry.handleKeyDown(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
      });
    },
  };
}

const pointer = (
  el: HTMLElement,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  x: number,
  y: number,
  extra: object = {},
) =>
  act(() => {
    fireEvent[type](el, {
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'pointerUp' ? 0 : 1,
      pointerId: 1,
      pointerType: 'mouse',
      ...extra,
    });
  });

const t = (key: string) => translateKey(`wireframe:${key}`);
const empty = () => createEmptyBoard('wireframe');
const wires = (doc: BoardDocument) => doc.elements.filter((e): e is WireElement => e.type === 'wire');

describe('wireframe plugin', () => {
  it('opens in wireframe mode with the wireframe scope', () => {
    const tt = setup(empty());
    expect(tt.scopes()).toEqual(['canvas', 'canvas.wireframe']);
  });

  it('registers the wire, frame and annotation element definitions', () => {
    expect(wireframePlugin.elements.map((e) => e.type)).toEqual(['wire', 'frame', 'annotation']);
    expect(frameDefinition.container).toBe(true);
    expect(wireDefinition.connectable && annotationDefinition.connectable).toBe(true);
  });

  it('renders every component, a frame and an annotation without errors', () => {
    const elements: BoardElement[] = [];
    const doc0 = empty();
    WIRE_KINDS.forEach((kind, i) => {
      const { element } = createWire({
        id: `w-${kind}`,
        entryId: kind,
        at: { x: 200 + (i % 6) * 400, y: 200 + Math.floor(i / 6) * 300 },
        t,
        doc: doc0,
      });
      elements.push(element);
    });
    // Variants with explicit states / props.
    elements.push({
      ...(elements.find((e) => e.id === 'w-dropdown') as WireElement),
      id: 'open',
      state: 'open',
      y: 2000,
    });
    elements.push({
      ...(elements.find((e) => e.id === 'w-input') as WireElement),
      id: 'focus',
      state: 'focused',
      y: 2000,
    });
    elements.push({
      ...(elements.find((e) => e.id === 'w-checkbox') as WireElement),
      id: 'chk',
      state: 'checked',
      y: 2000,
    });
    elements.push({ ...(elements.find((e) => e.id === 'w-toggle') as WireElement), id: 'tg', state: 'off', y: 2000 });
    elements.push(createFrame({ id: 'frame', device: 'iphone-14', at: { x: 0, y: 0 }, t }));
    elements.push({
      ...createFrame({ id: 'kb', device: 'ipad', at: { x: 3000, y: 0 }, t }),
      keyboard: true,
      orientation: 'landscape',
    });
    elements.push({
      id: 'ann',
      type: 'annotation',
      x: 0,
      y: 3000,
      w: 168,
      h: 48,
      color: 'purple',
      text: { blocks: [] },
      autoNumber: true,
      number: 1,
      outline: false,
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tt = setup(createEmptyBoard('wireframe', elements));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    // jsdom has no layout, so nothing is culled: every element is mounted.
    for (const el of elements) expect(tt.container.querySelector(`[data-element-id="${el.id}"]`), el.id).not.toBeNull();
    expect(tt.container.querySelector('.wf-button')).not.toBeNull();
    expect(tt.container.querySelector('.wf-rectangle')).not.toBeNull();
  });

  it('creates a button with the keyboard only (B, Enter)', () => {
    const tt = setup(empty());
    tt.key('b');
    tt.key('Enter');
    const [button] = wires(tt.content());
    expect(button).toMatchObject({ component: 'button', size: 'M', h: 32 });
    expect(plainText(button!.text)).toBe(t('defaults.button'));
    // Auto width: wider than the minimum for "Press me".
    expect(button!.w).toBeGreaterThanOrEqual(48);
    expect(button!.w % 4).toBe(0);
  });

  it('places P input, V avatar, O circle, R rectangle, G image with their keys', () => {
    const tt = setup(empty());
    for (const [key, component] of [
      ['p', 'input'],
      ['v', 'avatar'],
      ['o', 'circle'],
      ['r', 'rectangle'],
      ['g', 'image'],
    ] as const) {
      tt.key(key);
      tt.key('Enter');
      expect(wires(tt.content()).at(-1)?.component).toBe(component);
      tt.key('Escape');
      tt.key('Escape');
    }
    expect(wires(tt.content())).toHaveLength(5);
  });

  it('opens the component launcher with E, filters, picks and places with Enter', () => {
    const tt = setup(empty());
    tt.key('e');
    const input = tt.container.querySelector('.wf-panel input') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'modal' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(tt.container.querySelector('.wf-panel')).toBeNull();
    tt.key('Enter');
    const [overlay] = wires(tt.content());
    expect(overlay?.component).toBe('overlay');
  });

  it('escaping the launcher returns to Select', () => {
    const tt = setup(empty());
    tt.key('e');
    const input = tt.container.querySelector('.wf-panel input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(tt.container.querySelector('.wf-panel')).toBeNull();
    tt.key('b');
    tt.key('Enter');
    expect(wires(tt.content())[0]?.component).toBe('button');
  });

  it('opens the launcher from the toolbar button', () => {
    const tt = setup(empty());
    const button = tt.container.querySelector(
      `button[aria-label^="${translateKey('wireframe:commands.components')}"]`,
    ) as HTMLElement;
    expect(button).not.toBeNull();
    act(() => {
      fireEvent.click(button);
    });
    expect(tt.container.querySelector('.wf-panel')).not.toBeNull();
  });

  it('picks a frame with F then a digit and keeps frames behind components', () => {
    const tt = setup(empty());
    tt.key('b');
    tt.key('Enter');
    tt.key('Escape');
    tt.key('f');
    const input = tt.container.querySelector('.wf-panel input') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.keyDown(input, { key: '2' });
    tt.key('Enter');
    const frame = tt.content().elements.find((e): e is FrameElement => e.type === 'frame');
    expect(frame).toMatchObject({ device: 'iphone-14', statusBar: true, orientation: 'portrait' });
    expect(tt.content().elements[0]?.type).toBe('frame');
  });

  it('creates numbered annotations with A', () => {
    const tt = setup(empty());
    tt.key('a');
    tt.key('Enter');
    tt.key('Escape');
    tt.key('Escape');
    tt.key('a');
    tt.key('Enter');
    const annotations = tt.content().elements.filter((e): e is AnnotationElement => e.type === 'annotation');
    expect(annotations.map((a) => a.number)).toEqual([1, 2]);
    expect(tt.content().settings.nextAnnotationNumber).toBe(3);
    expect(plainText(annotations[0]!.text)).toBe(t('defaults.annotation'));
  });

  it('draws a line by dragging (L) and flips it with Shift', () => {
    const tt = setup(empty());
    tt.key('l');
    pointer(tt.canvas, 'pointerDown', 100, 100);
    pointer(tt.canvas, 'pointerMove', 300, 110);
    pointer(tt.canvas, 'pointerUp', 300, 110);
    let line = wires(tt.content())[0]!;
    expect(line).toMatchObject({ component: 'line', x: 100, w: 200, h: 4 });
    expect(line.props.direction).toBe('h');
    tt.key('d');
    pointer(tt.canvas, 'pointerDown', 500, 100);
    pointer(tt.canvas, 'pointerMove', 700, 110, { shiftKey: true });
    pointer(tt.canvas, 'pointerUp', 700, 110, { shiftKey: true });
    line = wires(tt.content())[1]!;
    expect(line).toMatchObject({ component: 'line', w: 4, h: 200 });
    expect(line.props.direction).toBe('v');
  });

  it('keeps lines in the frame they end up in, not the one the click box suggests', () => {
    const frame = createFrame({
      id: 'f',
      device: 'plain',
      at: { x: 0, y: 0 },
      rect: { x: 0, y: 0, w: 360, h: 640 },
      t,
    });
    const tt = setup(createEmptyBoard('wireframe', [frame]));
    // Started 20 px from the left edge: the 160 px click box would stick out, the drag does not.
    tt.key('l');
    pointer(tt.canvas, 'pointerDown', 20, 100);
    pointer(tt.canvas, 'pointerMove', 200, 100);
    pointer(tt.canvas, 'pointerUp', 200, 100);
    expect(wires(tt.content())[0]?.containerId).toBe('f');
    // Started inside, dragged out of the frame: it leaves the container.
    tt.key('l');
    pointer(tt.canvas, 'pointerDown', 100, 300);
    pointer(tt.canvas, 'pointerMove', 700, 300);
    pointer(tt.canvas, 'pointerUp', 700, 300);
    expect(wires(tt.content())[1]?.containerId).toBeUndefined();
  });

  it('finishes editing a single-line label with Enter', () => {
    const tt = setup(empty());
    tt.key('b');
    tt.key('Enter');
    tt.key('Enter');
    expect(tt.scopes()).toContain('textEdit');
    const editor = tt.container.querySelector('.ProseMirror') as HTMLElement;
    expect(editor).not.toBeNull();
    act(() => {
      fireEvent.keyDown(editor, { key: 'Enter' });
    });
    expect(tt.scopes()).not.toContain('textEdit');
    expect(wires(tt.content())[0]!.text.blocks).toHaveLength(1);
  });

  it('does not bind wireframe keys in diagram mode', () => {
    const tt = setup(empty());
    tt.key('q');
    expect(tt.scopes()).toEqual(['canvas', 'canvas.diagram']);
    tt.key('b');
    tt.key('Enter');
    expect(wires(tt.content())).toHaveLength(0);
    // A (annotation) works in both modes.
    tt.key('a');
    tt.key('Enter');
    expect(tt.content().elements.some((e) => e.type === 'annotation')).toBe(true);
  });
});

describe('wireframe file', () => {
  it('uses the .wwire extension and wireframe mode', () => {
    expect(wireframeEditor.extensions).toEqual(['.wwire']);
    expect(wireframeEditor.createEmpty().settings.mode).toBe('wireframe');
    expect(createCanvasEditorPlugin).toBeTypeOf('function');
  });

  it('round-trips components, frames and annotations through the file format and normalize', () => {
    const doc0 = empty();
    const frame = createFrame({ id: 'f', device: 'android', at: { x: 0, y: 0 }, t });
    const { element: button } = createWire({
      id: 'b',
      entryId: 'outlineButton',
      at: { x: 100, y: 100 },
      t,
      doc: { ...doc0, elements: [frame] },
    });
    const { element: tabs } = createWire({ id: 't', entryId: 'mobileTabs', at: { x: 100, y: 400 }, t });
    const annotation: AnnotationElement = {
      id: 'a',
      type: 'annotation',
      x: 0,
      y: 0,
      w: 168,
      h: 48,
      color: 'red',
      text: { blocks: [{ type: 'p', spans: [{ text: 'Hi' }] }] },
      autoNumber: true,
      number: 1,
      outline: true,
      icon: 'star',
    };
    const doc: BoardDocument = { ...doc0, elements: [frame, button, tabs, annotation] };
    const parsed = parseBoard(serializeBoard(doc), 'wireframe');
    expect(parsed).toEqual(doc);
    // Normalisation of a complete document changes nothing.
    expect(wireDefinition.normalize!(button)).toEqual(button);
    expect(frameDefinition.normalize!(frame)).toEqual(frame);
    expect(annotationDefinition.normalize!(annotation)).toEqual(annotation);
    expect(button.containerId).toBe('f');
  });

  it('fills missing fields of old or partial files', () => {
    const partial = { id: 'x', type: 'wire', component: 'button', x: 0, y: 0, w: 80, h: 32 } as unknown as WireElement;
    const n = wireDefinition.normalize!(partial);
    expect(n.state).toBe('default');
    expect(n.size).toBe('M');
    expect(n.props).toMatchObject({ variant: 'solid' });
    expect(n.text).toBeDefined();
    const unknownKind = { ...partial, component: 'future-widget' } as unknown as WireElement;
    expect(() => wireDefinition.normalize!(unknownKind)).not.toThrow();
  });
});
