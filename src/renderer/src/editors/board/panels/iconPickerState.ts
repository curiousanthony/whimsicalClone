/**
 * Hand-off between whoever opens the icon picker (tool, `X`, context bar) and the panel:
 * where to put a new icon, or which icon object to change. Module state is fine here, the
 * picker is a single modal-like popover per window.
 */

import type { CanvasApi, Point } from '@renderer/core/types';

export interface IconPickerRequest {
  /** World point at the centre of a new icon (default: viewport centre). */
  at?: Point;
  /** Replace the icon of this object instead of creating one. */
  replaceId?: string;
}

let pending: IconPickerRequest = {};

export function takeIconPickerRequest(): IconPickerRequest {
  const request = pending;
  pending = {};
  return request;
}

export function peekIconPickerRequest(): IconPickerRequest {
  return pending;
}

export const ICON_PICKER_PANEL = 'board.iconPicker';

/** Opens the picker panel for `request`, anchored near the new icon when a point is known. */
export function requestIconPicker(api: CanvasApi, request: IconPickerRequest = {}): void {
  pending = request;
  api.openPanel(ICON_PICKER_PANEL, request.at ? { anchor: api.worldToScreen(request.at) } : undefined);
}
