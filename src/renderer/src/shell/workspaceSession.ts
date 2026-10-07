/**
 * Workspace lifecycle in the renderer: boot (current window workspace, else the last one),
 * switching folders, closing, restoring tabs and wiring watcher events.
 */

import type { RelPath, WorkspaceInfo } from '@shared/ipc';
import { flushDocuments, handleFsEvents, resetDocuments } from './state/documents';
import { setPrefs, usePrefs } from './state/prefs';
import { openFile, persistNow, resetTabs, restoreTabs } from './state/tabs';
import { useUi } from './state/ui';
import { adoptWorkspace, loadMeta, openWorkspacePath, scheduleTreeRefresh, useWorkspace } from './state/workspace';
import { findNode } from './tree';

let offFsEvents: (() => void) | null = null;
let initialFileHandled = false;

/** True for windows opened with "New window" (they do not restore the saved tabs). */
function isFreshWindow(): boolean {
  return /(?:^#|&)fresh=1/.test(window.location.hash);
}

/** File requested through the window URL (`#open=<relPath>`, new windows). */
function initialFileFromHash(): RelPath | null {
  const match = /(?:^#|&)open=([^&]+)/.exec(window.location.hash);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function startSession(info: WorkspaceInfo): Promise<void> {
  offFsEvents?.();
  resetDocuments();
  resetTabs();
  useUi.setState({ treeSelection: [], renaming: null, search: null });
  await adoptWorkspace(info);
  offFsEvents = window.api.fs.onEvents((events) => {
    handleFsEvents(events);
    scheduleTreeRefresh();
    if (events.some((e) => e.type === 'unlink' || e.type === 'unlinkDir')) void loadMeta();
  });
  const tree = () => useWorkspace.getState().tree;
  const fresh = !initialFileHandled && isFreshWindow();
  const initial = initialFileHandled ? null : initialFileFromHash();
  initialFileHandled = true;
  await restoreTabs(
    (path, kind) => {
      const node = findNode(tree(), path);
      return !!node && (kind === 'folder' ? node.type === 'folder' : node.type === 'file');
    },
    { skipTabs: fresh },
  );
  if (initial && findNode(tree(), initial)) openFile(initial);
}

/** Boots this window: its seeded workspace, else the last workspace, else the welcome screen. */
export async function bootWorkspace(): Promise<void> {
  let info = await window.api.workspace.current();
  if (!info) {
    const last = usePrefs.getState().prefs.lastWorkspace;
    if (last) info = await openWorkspacePath(last, true);
  }
  if (info) await startSession(info);
  else useWorkspace.setState({ status: 'welcome' });
}

/** Switches to another (already opened by main) workspace, or closes it with null. */
export async function switchWorkspace(info: WorkspaceInfo | null): Promise<void> {
  await flushDocuments();
  if (useWorkspace.getState().info) await persistNow();
  if (info) {
    await startSession(info);
    return;
  }
  offFsEvents?.();
  offFsEvents = null;
  resetDocuments();
  resetTabs();
  useWorkspace.setState({ status: 'welcome', info: null, tree: null });
  await setPrefs({ lastWorkspace: null });
}

/** Flush everything before the window closes or the app quits. */
export async function flushBeforeQuit(): Promise<void> {
  await flushDocuments();
  if (useWorkspace.getState().info) await persistNow();
}
