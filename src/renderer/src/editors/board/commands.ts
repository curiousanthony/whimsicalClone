/** Runtime commands of the board module: distribute stickies as a grid, paste text as stickies. */

import { richTextFromPlain } from '@renderer/core/richText';
import type { CanvasApi, ShortcutHandler, StickyElement } from '@renderer/core/types';
import { createStickyElement, STYLE_KEYS } from './model';
import { distributeGrid, gridAround, splitPasteLines } from './stickyLayout';
import { pickAndInsertImages } from './imageImport';
import { requestIconPicker } from './panels/iconPickerState';
import { snapToGridPoint, viewCentre } from './viewHelpers';

function selectedStickies(api: CanvasApi): StickyElement[] {
  const ids = new Set(api.getSelection());
  return api.getDocument().elements.filter((e): e is StickyElement => e.type === 'sticky' && ids.has(e.id) && !e.locked);
}

/** "Distribute as grid": rearranges the selected sticky notes into an even grid. */
export function distributeSelectedStickies(api: CanvasApi): boolean {
  const stickies = selectedStickies(api);
  if (stickies.length < 2) return false;
  const targets = distributeGrid(stickies.map((s) => ({ id: s.id, rect: { x: s.x, y: s.y, w: s.w, h: s.h } })));
  api.update((d) => {
    for (const el of d.elements) {
      const p = targets.get(el.id);
      if (p && el.type === 'sticky') {
        el.x = p.x;
        el.y = p.y;
      }
    }
  });
  return true;
}

/** Creates one sticky note per entry, in a grid centred on the viewport; selects them. */
export function insertStickiesFromLines(api: CanvasApi, lines: readonly string[]): string[] {
  if (lines.length === 0) return [];
  const style = api.getStyleFor(STYLE_KEYS.sticky);
  const centre = snapToGridPoint(api, viewCentre(api));
  const spots = gridAround(centre, lines.length);
  const stickies = lines.map((line, i) => {
    const spot = snapToGridPoint(api, spots[i]!);
    return createStickyElement({ id: api.createId(), x: spot.x, y: spot.y, text: richTextFromPlain(line), style });
  });
  api.update((d) => {
    for (const sticky of stickies) d.elements.push(sticky);
  });
  const ids = stickies.map((s) => s.id);
  api.setSelection(ids);
  return ids;
}

async function pasteAsStickies(api: CanvasApi): Promise<void> {
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch {
    api.services.notify('board:notify.clipboardDenied', { kind: 'error' });
    return;
  }
  const lines = splitPasteLines(text);
  if (lines.length === 0) {
    api.services.notify('board:notify.nothingToPaste', { kind: 'info' });
    return;
  }
  insertStickiesFromLines(api, lines);
}

export function createBoardCommands(api: CanvasApi): ShortcutHandler[] {
  return [
    { id: 'board.distributeGrid', run: () => void distributeSelectedStickies(api), isEnabled: () => selectedStickies(api).length > 1 },
    { id: 'board.pasteAsStickies', run: () => void pasteAsStickies(api) },
    // I and X open their picker straight away (Whimsical); a click on the canvas while the tool
    // is armed (toolbar button) still places the result at the pointer.
    {
      id: 'board.image',
      run: () => {
        api.setActiveTool('canvas.selectTool');
        void pickAndInsertImages(api, snapToGridPoint(api, viewCentre(api)));
      },
      isEnabled: () => api.getMode() === 'diagram',
    },
    {
      id: 'board.icon',
      run: () => {
        api.setActiveTool('canvas.selectTool');
        requestIconPicker(api, { at: snapToGridPoint(api, viewCentre(api)) });
      },
    },
  ];
}
