/**
 * Shell root (owner: shell module): boots preferences + workspace, binds the app commands
 * and native menu, and lays out tab bar, sidebar, title bar, editor area, search panel and
 * overlays (command menu, help sheet, preferences, export).
 */

import { useEffect, useState } from 'react';
import { usePrefs } from './state/prefs';
import { initPrefs } from './state/prefs';
import { initScopes } from './state/scopes';
import { useUi } from './state/ui';
import { useWorkspace } from './state/workspace';
import { flushBeforeQuit, bootWorkspace } from './workspaceSession';
import { initCommands } from './commands';
import { Sidebar } from './sidebar/Sidebar';
import { TabBar } from './chrome/TabBar';
import { TitleBar } from './chrome/TitleBar';
import { Toasts } from './chrome/Toasts';
import { EditorArea } from './editorHost/EditorHost';
import { CommandMenu } from './overlays/CommandMenu';
import { ExportDialog } from './overlays/ExportDialog';
import { Preferences } from './overlays/Preferences';
import { SearchPanel } from './overlays/SearchPanel';
import { ShortcutsHelp } from './overlays/ShortcutsHelp';
import { Welcome } from './views/Welcome';
import { flushDocuments } from './state/documents';
import './shell.css';

let booted: Promise<void> | null = null;

/** One-time startup (idempotent under StrictMode double effects). */
function bootOnce(): Promise<void> {
  if (!booted) {
    booted = (async () => {
      if (!window.api) return;
      initScopes();
      await initPrefs();
      initCommands();
      window.api.app.onBeforeQuit(() => flushBeforeQuit());
      window.addEventListener('blur', () => void flushDocuments());
      await bootWorkspace();
    })();
  }
  return booted;
}

export function ShellRoot(): JSX.Element {
  const status = useWorkspace((s) => s.status);
  const overlay = useUi((s) => s.overlay);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void bootOnce().finally(() => setReady(true));
  }, []);

  if (!ready || status === 'booting') return <div className="shell-booting" />;

  return (
    <div className="shell">
      {status === 'ready' ? <Workspace /> : <WelcomeFrame />}
      {overlay === 'commandMenu' && <CommandMenu />}
      {overlay === 'help' && <ShortcutsHelp />}
      {overlay === 'preferences' && <Preferences />}
      {overlay === 'export' && <ExportDialog />}
      <Toasts />
    </div>
  );
}

function WelcomeFrame(): JSX.Element {
  return (
    <>
      <div className="shell-dragbar" />
      <Welcome />
    </>
  );
}

function Workspace(): JSX.Element {
  const pinned = usePrefs((s) => s.prefs.sidebarPinned);
  const peek = useUi((s) => s.sidebarPeek);
  const search = useUi((s) => s.search);
  return (
    <>
      <TabBar />
      <div className="shell-body">
        {pinned && <Sidebar />}
        {!pinned && peek && <Sidebar floating />}
        <main className="shell-main">
          <TitleBar />
          <EditorArea />
        </main>
        {search && <SearchPanel mode={search} />}
      </div>
    </>
  );
}
