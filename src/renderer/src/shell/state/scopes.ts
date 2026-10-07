/**
 * Computes the registry's active scopes: the active editor's scopes, replaced by
 * ["folderView"] while the sidebar / a folder view has focus, and by none (app only) while a
 * modal overlay is open.
 */

import { shortcutRegistry } from '@renderer/core/shortcuts';
import type { ScopeId } from '@renderer/core/types';
import { useUi } from './ui';

let editorScopes: readonly ScopeId[] = [];

export function computeScopes(editor: readonly ScopeId[], folderFocus: boolean, overlayOpen: boolean): ScopeId[] {
  if (overlayOpen) return [];
  if (folderFocus) return ['folderView'];
  return [...editor];
}

function apply(): void {
  const { folderFocus, overlay } = useUi.getState();
  shortcutRegistry.setActiveScopes(computeScopes(editorScopes, folderFocus, overlay !== null));
}

/** Scopes of the active editor, independent of focus and overlays (command menu context). */
export function getEditorScopes(): readonly ScopeId[] {
  return editorScopes;
}

export function setEditorScopes(scopes: readonly ScopeId[]): void {
  editorScopes = scopes;
  apply();
}

let subscribed = false;
export function initScopes(): void {
  if (subscribed) return;
  subscribed = true;
  useUi.subscribe((s, prev) => {
    if (s.folderFocus !== prev.folderFocus || s.overlay !== prev.overlay) apply();
  });
  apply();
}
