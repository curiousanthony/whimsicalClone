/**
 * Transient shell UI state: overlays, search panel, focus scopes, toasts, rename requests.
 */

import { create } from 'zustand';
import type { RelPath } from '@shared/ipc';
import { translateKey } from '@renderer/i18n';

export type Overlay = 'commandMenu' | 'help' | 'preferences' | 'export' | null;
export type SearchMode = 'workspace' | 'file';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

interface UiState {
  overlay: Overlay;
  search: SearchMode | null;
  /** Keyboard focus is in the sidebar tree or a folder view (scope "folderView"). */
  folderFocus: boolean;
  /** The unpinned sidebar is temporarily shown (hover). */
  sidebarPeek: boolean;
  toasts: Toast[];
  /** Path whose tree row / title should enter rename mode. */
  renaming: RelPath | null;
  /** Title of the active tab should enter rename mode (after creating a file). */
  titleRename: number;
  /** Selected rows in the sidebar tree (multi-select with Shift). */
  treeSelection: RelPath[];
}

export const useUi = create<UiState>()(() => ({
  overlay: null,
  search: null,
  folderFocus: false,
  sidebarPeek: false,
  toasts: [],
  renaming: null,
  titleRename: 0,
  treeSelection: [],
}));

let toastSeq = 0;

export function showToast(message: string, kind: Toast['kind'] = 'info', timeoutMs = 4000): void {
  const id = ++toastSeq;
  useUi.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, kind }] }));
  window.setTimeout(() => dismissToast(id), timeoutMs);
}

/** Toast from an i18n key ("ns:path"). */
export function notifyKey(
  key: string,
  options: { kind?: 'info' | 'error'; values?: Record<string, unknown> } = {},
): void {
  showToast(translateKey(key, options.values), options.kind ?? 'info');
}

export function dismissToast(id: number): void {
  useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function openOverlay(overlay: Overlay): void {
  useUi.setState({ overlay });
}

export function closeOverlay(): void {
  useUi.setState({ overlay: null });
}

/** Maps an IpcResult error code to a translated message. */
export function errorMessage(code: string, fallback?: string): string {
  const text = translateKey(`common:errors.${code}`);
  return text === `errors.${code}` || text === `common:errors.${code}` ? (fallback ?? code) : text;
}
