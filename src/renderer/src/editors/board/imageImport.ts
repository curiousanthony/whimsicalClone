/** Image tool (I): file picker, import into the workspace asset store, placement. */

import type { CanvasApi, Point } from '@renderer/core/types';
import { createImageElement } from './model';
import { rowLayout } from './placement';

/** Opens the native file picker (Electron renders it for a detached <input type=file>). */
export function pickImageFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])));
    input.addEventListener('cancel', () => finish([]));
    input.click();
  });
}

/** Imports the files and places them in a row centred on `centre`; selects the new images. */
export async function insertImageFiles(api: CanvasApi, files: readonly File[], centre: Point): Promise<string[]> {
  const imported: Array<{ url: string; width: number; height: number; name: string }> = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      imported.push({ ...(await api.importImage(file, file.name)), name: file.name });
    } catch {
      api.services.notify('board:notify.imageImportFailed', { kind: 'error' });
    }
  }
  if (imported.length === 0) return [];
  const probes = imported.map((item) => createImageElement({ id: '', centre: { x: 0, y: 0 }, url: item.url, width: item.width, height: item.height }));
  const spots = rowLayout(probes, centre);
  const images = imported.map((item, i) => {
    const spot = spots[i]!;
    const probe = probes[i]!;
    return createImageElement({
      id: api.createId(),
      centre: { x: spot.x + probe.w / 2, y: spot.y + probe.h / 2 },
      url: item.url,
      width: item.width,
      height: item.height,
    });
  });
  api.update((d) => {
    for (const image of images) d.elements.push(image);
  });
  const ids = images.map((i) => i.id);
  api.setSelection(ids);
  return ids;
}

/** Tool entry point: pick, import, place. */
export async function pickAndInsertImages(api: CanvasApi, centre: Point): Promise<void> {
  const files = await pickImageFiles();
  if (files.length > 0) await insertImageFiles(api, files, centre);
}
