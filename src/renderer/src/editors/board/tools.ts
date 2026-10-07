/**
 * Board tools. Each tool id equals the id of its shortcut row (board.sticky, board.text, ...),
 * so the canvas binds N, T, I, K, X, ., E automatically; "N, Enter" drops a sticky note at the
 * viewport centre and starts editing it (keyboard-only flow).
 */

import { translateKey } from '@renderer/i18n';
import type { CanvasApi, Point, Rect, ToolDefinition } from '@renderer/core/types';
import { pickAndInsertImages } from './imageImport';
import {
  createCodeElement,
  createLinkElement,
  createSectionElement,
  createStickyElement,
  createTextElement,
  CODE_DEFAULT_SIZE,
  LINK_CARD_SIZE,
  SECTION_DEFAULT_SIZE,
  STICKY_SIZE,
  STYLE_KEYS,
  TABLE_COLUMN_WIDTH,
  TABLE_ROW_HEIGHT,
  TEXT_PADDING,
} from './model';
import { requestIconPicker } from './panels/iconPickerState';
import { centredTopLeft, squareRect, wrappedByNewSection } from './placement';
import { createTable, gridForRect } from './tableLogic';

const BOTH = ['diagram', 'wireframe'] as const;

/** Creates a sticky note centred on `at` (or filling a dragged rect, kept square). */
export function createStickyAt(api: CanvasApi, at: Point, rect?: Rect): string {
  const id = api.createId();
  const square = rect ? squareRect(rect) : undefined;
  const topLeft = centredTopLeft(at, STICKY_SIZE, STICKY_SIZE, api.getGridSize());
  const sticky = createStickyElement({ id, x: topLeft.x, y: topLeft.y, rect: square, style: api.getStyleFor(STYLE_KEYS.sticky) });
  api.update((d) => {
    d.elements.push(sticky);
  });
  return id;
}

export function createTextAt(api: CanvasApi, at: Point, rect?: Rect): string {
  const id = api.createId();
  const text = createTextElement({ id, x: at.x - TEXT_PADDING, y: at.y - TEXT_PADDING, rect, style: api.getStyleFor(STYLE_KEYS.text) });
  api.update((d) => {
    d.elements.push(text);
  });
  return id;
}

export function createSectionAt(api: CanvasApi, at: Point, rect: Rect | undefined, name: string): string {
  const id = api.createId();
  const origin = rect ? at : centredTopLeft(at, SECTION_DEFAULT_SIZE.w, SECTION_DEFAULT_SIZE.h, api.getGridSize());
  const section = createSectionElement({ id, x: origin.x, y: origin.y, rect, name, style: api.getStyleFor(STYLE_KEYS.section) });
  const doc = api.getDocument();
  // Objects fully inside a newly drawn section join it (moving the section later moves them).
  const wrapped = new Set(
    rect
      ? wrappedByNewSection(
          doc.elements,
          rect,
          (el) => api.getDefinition(el.type)?.getBounds(el, doc),
          (el) => !!api.getDefinition(el.type)?.container,
        )
      : [],
  );
  api.update((d) => {
    for (const el of d.elements) if (wrapped.has(el.id)) el.containerId = id;
    d.elements.push(section);
  });
  return id;
}

export function createTableAt(api: CanvasApi, at: Point, rect?: Rect): string {
  const id = api.createId();
  const grid = rect ? gridForRect(rect) : undefined;
  // Default 3 x 3 table, centred on the point like the other default-size objects.
  const origin = rect ? rect : centredTopLeft(at, 3 * TABLE_COLUMN_WIDTH, 3 * TABLE_ROW_HEIGHT, api.getGridSize());
  const table = createTable({
    id,
    x: origin.x,
    y: origin.y,
    columns: grid?.columns,
    rows: grid?.rows,
    width: rect?.w,
    newId: () => api.createId(),
  });
  api.update((d) => {
    d.elements.push(table);
  });
  return id;
}

export function createCodeAt(api: CanvasApi, at: Point, rect?: Rect): string {
  const id = api.createId();
  const origin = rect ? at : centredTopLeft(at, CODE_DEFAULT_SIZE.w, CODE_DEFAULT_SIZE.h, api.getGridSize());
  const code = createCodeElement({ id, x: origin.x, y: origin.y, rect });
  api.update((d) => {
    d.elements.push(code);
  });
  return id;
}

export function createLinkAt(api: CanvasApi, at: Point): string {
  const id = api.createId();
  const origin = centredTopLeft(at, LINK_CARD_SIZE.w, LINK_CARD_SIZE.h, api.getGridSize());
  const link = createLinkElement({ id, x: origin.x, y: origin.y });
  api.update((d) => {
    d.elements.push(link);
  });
  return id;
}

export const boardTools: ToolDefinition[] = [
  {
    id: 'board.sticky',
    module: 'board',
    labelKey: 'board:commands.sticky',
    icon: 'StickyNote',
    shortcutId: 'board.sticky',
    group: 'sticky',
    modes: BOTH,
    keywordsKey: 'board:keywords.sticky',
    cursor: 'crosshair',
    editAfterCreate: true,
    create: (api, at, rect) => [createStickyAt(api, at, rect)],
  },
  {
    id: 'board.text',
    module: 'board',
    labelKey: 'board:commands.text',
    icon: 'Type',
    shortcutId: 'board.text',
    group: 'text',
    modes: BOTH,
    keywordsKey: 'board:keywords.text',
    cursor: 'text',
    editAfterCreate: true,
    create: (api, at, rect) => [createTextAt(api, at, rect)],
  },
  {
    id: 'board.image',
    module: 'board',
    labelKey: 'board:commands.image',
    icon: 'Image',
    shortcutId: 'board.image',
    group: 'image',
    modes: ['diagram'],
    keywordsKey: 'board:keywords.image',
    cursor: 'crosshair',
    create: (api, at) => {
      void pickAndInsertImages(api, at);
      return [];
    },
  },
  {
    id: 'board.link',
    module: 'board',
    labelKey: 'board:commands.link',
    icon: 'Link',
    shortcutId: 'board.link',
    group: 'link',
    modes: BOTH,
    keywordsKey: 'board:keywords.link',
    cursor: 'crosshair',
    editAfterCreate: true,
    create: (api, at) => [createLinkAt(api, at)],
  },
  {
    id: 'board.icon',
    module: 'board',
    labelKey: 'board:commands.icon',
    icon: 'Smile',
    shortcutId: 'board.icon',
    group: 'icon',
    modes: BOTH,
    keywordsKey: 'board:keywords.icon',
    cursor: 'crosshair',
    create: (api, at) => {
      requestIconPicker(api, { at });
      return [];
    },
  },
  {
    id: 'board.section',
    module: 'board',
    labelKey: 'board:commands.section',
    icon: 'SquareDashed',
    shortcutId: 'board.section',
    group: 'section',
    modes: BOTH,
    keywordsKey: 'board:keywords.section',
    cursor: 'crosshair',
    editAfterCreate: true,
    create: (api, at, rect) => [createSectionAt(api, at, rect, translateKey('board:section.defaultName'))],
  },
  {
    id: 'board.table',
    module: 'board',
    labelKey: 'board:commands.table',
    icon: 'Table',
    shortcutId: 'board.table',
    group: 'table',
    modes: ['diagram'],
    keywordsKey: 'board:keywords.table',
    cursor: 'crosshair',
    editAfterCreate: true,
    create: (api, at, rect) => [createTableAt(api, at, rect)],
  },
  {
    id: 'board.codeBlock',
    module: 'board',
    labelKey: 'board:commands.codeBlock',
    icon: 'CodeXml',
    shortcutId: 'board.codeBlock',
    group: 'allTools',
    modes: ['diagram'],
    keywordsKey: 'board:keywords.codeBlock',
    cursor: 'crosshair',
    editAfterCreate: true,
    create: (api, at, rect) => [createCodeAt(api, at, rect)],
  },
];
