/**
 * Preload (sandboxed, contextIsolation). Exposes `window.api` implementing DesktopApi by
 * forwarding to the IPC channels in @shared/ipc. Owner: architect (contract); the shell /
 * platform agent may add channels only together with @shared/ipc changes.
 */

import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { IPC, type DesktopApi, type FsEvent, type Preferences } from '@shared/ipc';

function on<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_e: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

const api: DesktopApi = {
  platform: process.platform as DesktopApi['platform'],

  workspace: {
    pick: (dialogTitle) => ipcRenderer.invoke(IPC.workspacePick, dialogTitle),
    open: (absPath) => ipcRenderer.invoke(IPC.workspaceOpen, absPath),
    current: () => ipcRenderer.invoke(IPC.workspaceCurrent),
    readMeta: () => ipcRenderer.invoke(IPC.workspaceReadMeta),
    writeMeta: (meta) => ipcRenderer.invoke(IPC.workspaceWriteMeta, meta),
  },

  fs: {
    listTree: () => ipcRenderer.invoke(IPC.fsListTree),
    readFile: (path) => ipcRenderer.invoke(IPC.fsReadFile, path),
    writeFile: (path, content, options) => ipcRenderer.invoke(IPC.fsWriteFile, path, content, options),
    createFile: (dir, baseName, extension, content) =>
      ipcRenderer.invoke(IPC.fsCreateFile, dir, baseName, extension, content),
    createFolder: (dir, baseName) => ipcRenderer.invoke(IPC.fsCreateFolder, dir, baseName),
    rename: (path, newName) => ipcRenderer.invoke(IPC.fsRename, path, newName),
    move: (path, destDir) => ipcRenderer.invoke(IPC.fsMove, path, destDir),
    duplicate: (path, destDir) => ipcRenderer.invoke(IPC.fsDuplicate, path, destDir),
    trash: (path) => ipcRenderer.invoke(IPC.fsTrash, path),
    stat: (path) => ipcRenderer.invoke(IPC.fsStat, path),
    revealInFinder: (path) => ipcRenderer.invoke(IPC.fsReveal, path),
    onEvents: (listener) => on<FsEvent[]>(IPC.fsEvents, listener),
  },

  assets: {
    importBytes: (name, bytes) => ipcRenderer.invoke(IPC.assetsImportBytes, name, bytes),
    importFile: (absPath) => ipcRenderer.invoke(IPC.assetsImportFile, absPath),
    getPathForFile: (file) => webUtils.getPathForFile(file),
  },

  prefs: {
    get: () => ipcRenderer.invoke(IPC.prefsGet),
    set: (patch) => ipcRenderer.invoke(IPC.prefsSet, patch),
    onChange: (listener) => on<Preferences>(IPC.prefsChanged, listener),
  },

  viewState: {
    get: (key) => ipcRenderer.invoke(IPC.viewStateGet, key),
    set: (key, value) => ipcRenderer.invoke(IPC.viewStateSet, key, value),
  },

  app: {
    setMenu: (spec) => ipcRenderer.invoke(IPC.appSetMenu, spec),
    onMenuCommand: (listener) => on<string>(IPC.appMenuCommand, listener),
    getSystemDarkMode: () => ipcRenderer.invoke(IPC.appGetSystemDarkMode),
    onSystemDarkModeChange: (listener) => on<boolean>(IPC.appSystemDarkModeChanged, listener),
    getLocale: () => ipcRenderer.invoke(IPC.appGetLocale),
    setWindowTitle: (title) => ipcRenderer.invoke(IPC.appSetWindowTitle, title),
    confirm: (options) => ipcRenderer.invoke(IPC.appConfirm, options),
    saveExport: (options, data) => ipcRenderer.invoke(IPC.appSaveExport, options, data),
    openExternal: (url) => ipcRenderer.invoke(IPC.appOpenExternal, url),
    newWindow: (path) => ipcRenderer.invoke(IPC.appNewWindow, path),
    onBeforeQuit: (listener) =>
      on<void>(IPC.appBeforeQuit, () => {
        void listener().finally(() => ipcRenderer.send(IPC.appBeforeQuitDone));
      }),
  },
};

contextBridge.exposeInMainWorld('api', api);
