/**
 * System clipboard integration (DOM copy / cut / paste events, which the native Edit menu
 * roles and Cmd+C / Cmd+X / Cmd+V trigger). Payload: CLIPBOARD_MIME JSON + text/plain.
 */

import type { Draft } from 'immer';
import type { BoardElement, ImageElement, Point } from '@renderer/core/types';
import { isTextInputTarget } from '@renderer/core/shortcuts';
import { plainText, richTextFromPlain } from '@renderer/core/richText';
import { CLIPBOARD_MIME, cloneElements, collectForCopy, parseClipboard, serializeClipboard, type ClipboardPayload } from '../clipboard';
import { snapToGrid } from '../geometry';
import { rectCenter, rectContainsPoint } from '../geometry';
import { CanvasEngine, boundsResolverFor } from './engine';
import { deleteSelection } from './commands';

/** Last payload copied by this app (fallback when the custom MIME type is stripped). */
let lastCopied: { text: string; payload: ClipboardPayload } | undefined;

function shouldIgnore(engine: CanvasEngine): boolean {
  if (engine.getEditingId()) return true;
  return isTextInputTarget(document.activeElement);
}

function plainTextOf(engine: CanvasEngine, elements: readonly BoardElement[]): string {
  return elements
    .map((el) => engine.lookup(el.type)?.getText?.(el as never))
    .filter((t) => !!t)
    .map((t) => plainText(t))
    .filter((s) => s.trim() !== '')
    .join('\n');
}

export function handleCopy(engine: CanvasEngine, e: ClipboardEvent, cut = false): void {
  if (shouldIgnore(engine) || !e.clipboardData) return;
  const ids = engine.getSelection();
  if (ids.length === 0) return;
  const doc = engine.getDocument();
  const payload = collectForCopy(doc, ids, boundsResolverFor(doc), (id) => engine.boundsOf(id));
  if (!payload) return;
  e.preventDefault();
  const json = serializeClipboard(payload);
  const text = plainTextOf(engine, payload.elements) || ' ';
  e.clipboardData.setData(CLIPBOARD_MIME, json);
  e.clipboardData.setData('text/plain', text);
  lastCopied = { text, payload };
  engine.resetPasteOffset();
  if (cut) deleteSelection(engine);
}

/** Inserts clipboard elements: in place (cascading) when visible, else centred in the view. */
export function pastePayload(engine: CanvasEngine, payload: ClipboardPayload): string[] {
  const view = engine.visibleWorldRect();
  const centre = rectCenter(payload.bounds);
  const grid = Math.max(engine.getGridSize(), 1);
  let offset: Point;
  if (rectContainsPoint(view, centre)) {
    const n = engine.nextPasteOffset();
    const step = Math.max(grid, 12) * 2;
    offset = { x: step * n, y: step * n };
  } else {
    const target = rectCenter(view);
    offset = { x: snapToGrid(target.x - centre.x, grid), y: snapToGrid(target.y - centre.y, grid) };
  }
  const clones = cloneElements(payload.elements, () => engine.createId(), offset);
  engine.update((d) => {
    d.elements.push(...(clones as Draft<BoardElement>[]));
  });
  const ids = clones.map((c) => c.id);
  engine.setSelection(ids);
  return ids;
}

async function pasteImage(engine: CanvasEngine, file: File, at?: Point): Promise<void> {
  if (!engine.lookup('image')) return;
  try {
    const { url, width, height } = await engine.importImage(file, file.name);
    const maxW = 480;
    const scale = width > maxW ? maxW / width : 1;
    const w = Math.max(24, Math.round(width * scale) || 240);
    const h = Math.max(24, Math.round(height * scale) || 180);
    const view = engine.visibleWorldRect();
    const c = at ?? rectCenter(view);
    const image: ImageElement = {
      id: engine.createId(),
      type: 'image',
      x: Math.round(c.x - w / 2),
      y: Math.round(c.y - h / 2),
      w,
      h,
      src: url,
      naturalWidth: width,
      naturalHeight: height,
    };
    engine.update((d) => {
      d.elements.push(image as Draft<ImageElement>);
    });
    engine.setSelection([image.id]);
  } catch {
    engine.services.notify('canvas:notify.imageImportFailed', { kind: 'error' });
  }
}

export function handlePaste(engine: CanvasEngine, e: ClipboardEvent): void {
  if (shouldIgnore(engine) || !e.clipboardData) return;
  const data = e.clipboardData;
  const text = data.getData('text/plain');
  let payload = parseClipboard(data.getData(CLIPBOARD_MIME));
  if (!payload && lastCopied && text && text === lastCopied.text) payload = lastCopied.payload;
  if (payload) {
    e.preventDefault();
    pastePayload(engine, payload);
    return;
  }
  const files = Array.from(data.files ?? []).filter((f) => f.type.startsWith('image/'));
  if (files.length > 0) {
    e.preventDefault();
    for (const f of files) void pasteImage(engine, f);
    return;
  }
  if (!text.trim()) return;
  e.preventDefault();
  // Pasting text onto a selected text-holding object replaces its text (Whimsical).
  const sel = engine.getSelection();
  if (sel.length === 1) {
    const el = engine.getElement(sel[0]!);
    const def = el && engine.lookup(el.type);
    if (el && def?.setText && def.textEditable) {
      engine.setElementText(el.id, richTextFromPlain(text));
      return;
    }
  }
  // Otherwise create a text object (board module) at the view centre.
  const textTool = engine.getTool('board.text');
  if (textTool?.create) {
    const ids = textTool.create(engine, rectCenter(engine.visibleWorldRect()));
    const id = ids[0];
    if (id) {
      engine.setElementText(id, richTextFromPlain(text));
      engine.setSelection(ids);
    }
  }
}

/** Drop of image files from Finder onto the canvas. */
export function handleDrop(engine: CanvasEngine, e: DragEvent, world: Point): void {
  const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
  if (files.length === 0) return;
  e.preventDefault();
  files.forEach((f, i) => void pasteImage(engine, f, { x: world.x + i * 24, y: world.y + i * 24 }));
}
