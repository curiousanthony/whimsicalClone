/**
 * Composition root (owner: shell module). Provides i18n, canvas plugins, the global
 * keyboard listener, and renders the shell.
 */

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { CanvasPluginsContext } from '@renderer/core/canvasPlugins';
import { shortcutRegistry } from '@renderer/core/shortcuts';
import { i18n } from '@renderer/i18n';
import { ShellRoot } from '@renderer/shell/ShellRoot';
import { allShortcutDefs, canvasPlugins } from './editors';

let defined = false;

/** Registers every static shortcut table exactly once (idempotent under StrictMode). */
export function ensureShortcutsDefined(): void {
  if (defined) return;
  shortcutRegistry.define(allShortcutDefs);
  defined = true;
}

export function App(): JSX.Element {
  ensureShortcutsDefined();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      shortcutRegistry.handleKeyDown(e);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <CanvasPluginsContext.Provider value={canvasPlugins}>
        <ShellRoot />
      </CanvasPluginsContext.Provider>
    </I18nextProvider>
  );
}
