/**
 * Electron main process (owner: platform/shell). App lifecycle, windows, the wsasset://
 * protocol and every IPC channel of @shared/ipc. One workspace per window; each window owns
 * its watcher and receives only its own fs events.
 */

import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  net,
  protocol,
  shell,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron';
import { writeFile } from 'node:fs/promises';
import { ASSET_PROTOCOL } from '@shared/fileKinds';
import {
  IPC,
  type ConfirmDialogOptions,
  type IpcResult,
  type Preferences,
  type RelPath,
  type SaveDialogOptions,
  type WorkspaceInfo,
  type WorkspaceMeta,
  type WriteFileOptions,
} from '@shared/ipc';
import { enResources } from '@shared/i18n/resources';
import type { MenuSpec } from '@shared/menu';
import { resolveAssetRequest, storeAsset, storeAssetFromFile, type ImageSizeReader } from './assets';
import { IpcError, toResult } from './errors';
import { PreferencesStore, ViewStateStore } from './jsonStore';
import { menuTemplate } from './menu';
import { normalizeRel } from './paths';
import { EchoFilter, startWatcher, type WorkspaceWatcher } from './watcher';
import { WorkspaceFs } from './workspaceFs';

protocol.registerSchemesAsPrivileged([
  { scheme: ASSET_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL;
const prefsStore = new PreferencesStore(join(app.getPath('userData'), 'preferences.json'));
const viewStateStore = new ViewStateStore(join(app.getPath('userData'), 'view-state'));

/* ------------------------------------------------------------------ workspace sessions */

interface Session {
  info: WorkspaceInfo;
  fs: WorkspaceFs;
  echo: EchoFilter;
  watcher: WorkspaceWatcher | null;
}

/** Keyed by webContents id. */
const sessions = new Map<number, Session>();
/** Workspace opening in progress for a window (new windows are seeded before load). */
const pendingOpens = new Map<number, Promise<unknown>>();

async function closeSession(wcId: number): Promise<void> {
  const session = sessions.get(wcId);
  sessions.delete(wcId);
  await session?.watcher?.close();
}

async function openSession(contents: WebContents, absPath: string): Promise<WorkspaceInfo> {
  const echo = new EchoFilter();
  const fs = await WorkspaceFs.open(absPath, {
    trash: (p) => shell.trashItem(p),
    onOwnWrite: (rel, hash) => echo.record(rel, hash),
  });
  await closeSession(contents.id);
  const info: WorkspaceInfo = { rootPath: fs.root, name: fs.root.split('/').pop() || fs.root };
  const session: Session = { info, fs, echo, watcher: null };
  sessions.set(contents.id, session);
  try {
    session.watcher = await startWatcher(fs.root, echo, (events) => {
      if (!contents.isDestroyed() && sessions.get(contents.id) === session) contents.send(IPC.fsEvents, events);
    });
  } catch {
    // Watching is best effort; the renderer still works without live updates.
  }
  broadcastPrefs(await prefsStore.recordWorkspace(fs.root));
  return info;
}

async function sessionFor(event: IpcMainInvokeEvent): Promise<Session> {
  const pending = pendingOpens.get(event.sender.id);
  if (pending) await pending.catch(() => undefined);
  const session = sessions.get(event.sender.id);
  if (!session) throw new IpcError('NO_WORKSPACE', 'No workspace is open in this window');
  return session;
}

/* ------------------------------------------------------------------ preferences */

function broadcastPrefs(prefs: Preferences): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send(IPC.prefsChanged, prefs);
  }
}

function applyThemeSource(prefs: Preferences): void {
  nativeTheme.themeSource = prefs.theme;
}

/* ------------------------------------------------------------------ windows */

const menuSpecs = new Map<number, MenuSpec>();
const allowClose = new WeakSet<BrowserWindow>();
let quitFlushed = false;
let quitInProgress = false;

/** Seeded (new) windows start fresh instead of restoring the workspace's saved tabs. */
function rendererHash(seed?: { filePath?: RelPath }): string | undefined {
  if (!seed) return undefined;
  return seed.filePath ? `fresh=1&open=${encodeURIComponent(seed.filePath)}` : 'fresh=1';
}

function createWindow(seed?: { workspaceRoot: string; filePath?: RelPath }): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 720,
    minHeight: 480,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 12 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f171f' : '#f7f9fa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  const wcId = win.webContents.id;
  if (seed) {
    const opening = openSession(win.webContents, seed.workspaceRoot).finally(() => pendingOpens.delete(wcId));
    pendingOpens.set(wcId, opening);
  }
  win.once('ready-to-show', () => win.show());
  win.on('focus', () => applyMenu(wcId));
  win.on('close', (event) => {
    if (quitFlushed || allowClose.has(win)) return;
    event.preventDefault();
    void flushWindow(win).then(() => {
      allowClose.add(win);
      if (!win.isDestroyed()) win.close();
    });
  });
  win.on('closed', () => {
    menuSpecs.delete(wcId);
    void closeSession(wcId);
  });

  const hash = rendererHash(seed);
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devUrl) void win.loadURL(hash ? `${devUrl}#${hash}` : devUrl);
  else void win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : {});
  return win;
}

/** Asks one renderer to flush pending autosaves; resolves on done or after 3 s. */
const flushResolvers = new Map<number, () => void>();
function flushWindow(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed() || win.webContents.isDestroyed()) return Promise.resolve();
  const id = win.webContents.id;
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      flushResolvers.delete(id);
      resolve();
    };
    const timer = setTimeout(done, 3000);
    flushResolvers.set(id, done);
    win.webContents.send(IPC.appBeforeQuit);
  });
}

/* ------------------------------------------------------------------ menu */

function sendMenuCommand(commandId: string): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (win && !win.webContents.isDestroyed()) win.webContents.send(IPC.appMenuCommand, commandId);
}

function applyMenu(wcId: number): void {
  const spec = menuSpecs.get(wcId);
  if (!spec) return;
  const options = { onCommand: sendMenuCommand, isDev: !app.isPackaged };
  try {
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(spec, options)));
  } catch {
    // An accelerator Electron cannot parse must not cost the whole menu.
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(spec, { ...options, withoutAccelerators: true })));
  }
}

/** Minimal menu until the renderer sends the translated MenuSpec (api.app.setMenu). */
function setBootstrapMenu(): void {
  const m = enResources.menu;
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: m.app,
        submenu: [
          { role: 'about', label: m.about },
          { type: 'separator' },
          { role: 'hide', label: m.hide },
          { role: 'quit', label: m.quit },
        ],
      },
      {
        label: m.edit,
        submenu: [
          { role: 'cut', label: m.cut },
          { role: 'copy', label: m.copy },
          { role: 'paste', label: m.paste },
        ],
      },
      {
        label: m.window,
        submenu: [
          { role: 'minimize', label: m.minimize },
          { role: 'zoom', label: m.zoom },
        ],
      },
    ]),
  );
}

/* ------------------------------------------------------------------ IPC */

const readImageSize: ImageSizeReader = (bytes) => {
  try {
    const image = nativeImage.createFromBuffer(Buffer.from(bytes));
    if (image.isEmpty()) return null;
    return image.getSize();
  } catch {
    return null;
  }
};

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  throw new IpcError('IO_ERROR', 'Expected binary data');
}

function registerIpc(): void {
  // Workspace
  ipcMain.handle(IPC.workspacePick, async (event, title: string): Promise<IpcResult<WorkspaceInfo | null>> =>
    toResult(async () => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const options: Electron.OpenDialogOptions = {
        title: String(title ?? ''),
        properties: ['openDirectory', 'createDirectory'],
      };
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      const rootPath = result.canceled ? undefined : result.filePaths[0];
      if (!rootPath) return null;
      return openSession(event.sender, rootPath);
    }),
  );
  ipcMain.handle(IPC.workspaceOpen, (event, absPath: string) => toResult(() => openSession(event.sender, absPath)));
  ipcMain.handle(IPC.workspaceCurrent, async (event) => {
    const pending = pendingOpens.get(event.sender.id);
    if (pending) await pending.catch(() => undefined);
    return sessions.get(event.sender.id)?.info ?? null;
  });
  ipcMain.handle(IPC.workspaceReadMeta, (event) => toResult(async () => (await sessionFor(event)).fs.readMeta()));
  ipcMain.handle(IPC.workspaceWriteMeta, (event, meta: WorkspaceMeta) =>
    toResult(async () => (await sessionFor(event)).fs.writeMeta(meta)),
  );

  // File system
  ipcMain.handle(IPC.fsListTree, (event) => toResult(async () => (await sessionFor(event)).fs.listTree()));
  ipcMain.handle(IPC.fsReadFile, (event, path: RelPath) =>
    toResult(async () => (await sessionFor(event)).fs.readFile(path)),
  );
  ipcMain.handle(IPC.fsWriteFile, (event, path: RelPath, content: string, options?: WriteFileOptions) =>
    toResult(async () => {
      if (typeof content !== 'string') throw new IpcError('IO_ERROR', 'Content must be a string');
      return (await sessionFor(event)).fs.writeFile(path, content, options ?? {});
    }),
  );
  ipcMain.handle(IPC.fsCreateFile, (event, dir: RelPath, baseName: string, ext: string, content: string) =>
    toResult(async () => (await sessionFor(event)).fs.createFile(dir, baseName, ext, String(content ?? ''))),
  );
  ipcMain.handle(IPC.fsCreateFolder, (event, dir: RelPath, baseName: string) =>
    toResult(async () => (await sessionFor(event)).fs.createFolder(dir, baseName)),
  );
  ipcMain.handle(IPC.fsRename, (event, path: RelPath, newName: string) =>
    toResult(async () => (await sessionFor(event)).fs.rename(path, newName)),
  );
  ipcMain.handle(IPC.fsMove, (event, path: RelPath, destDir: RelPath) =>
    toResult(async () => (await sessionFor(event)).fs.move(path, destDir)),
  );
  ipcMain.handle(IPC.fsDuplicate, (event, path: RelPath, destDir?: RelPath) =>
    toResult(async () => (await sessionFor(event)).fs.duplicate(path, destDir ?? undefined)),
  );
  ipcMain.handle(IPC.fsTrash, (event, path: RelPath) => toResult(async () => (await sessionFor(event)).fs.trash(path)));
  ipcMain.handle(IPC.fsStat, (event, path: RelPath) => toResult(async () => (await sessionFor(event)).fs.stat(path)));
  ipcMain.handle(IPC.fsReveal, async (event, path: RelPath) => {
    try {
      shell.showItemInFolder(await (await sessionFor(event)).fs.absolute(path));
    } catch {
      // ignore invalid paths
    }
  });

  // Assets
  ipcMain.handle(IPC.assetsImportBytes, (event, name: string, bytes: ArrayBuffer) =>
    toResult(async () =>
      storeAsset((await sessionFor(event)).fs.root, String(name ?? ''), toBytes(bytes), readImageSize),
    ),
  );
  ipcMain.handle(IPC.assetsImportFile, (event, absPath: string) =>
    toResult(async () => storeAssetFromFile((await sessionFor(event)).fs.root, absPath, readImageSize)),
  );

  // Preferences
  ipcMain.handle(IPC.prefsGet, () => prefsStore.get());
  ipcMain.handle(IPC.prefsSet, async (_event, patch: Partial<Preferences>) => {
    const prefs = await prefsStore.set(patch && typeof patch === 'object' ? patch : {});
    applyThemeSource(prefs);
    broadcastPrefs(prefs);
    return prefs;
  });

  // View state (per workspace of the calling window)
  ipcMain.handle(IPC.viewStateGet, async (event, key: string) => {
    const session = sessions.get(event.sender.id);
    if (!session || typeof key !== 'string') return undefined;
    return viewStateStore.get(session.fs.root, key);
  });
  ipcMain.handle(IPC.viewStateSet, async (event, key: string, value: unknown) => {
    const session = sessions.get(event.sender.id);
    if (!session || typeof key !== 'string') return;
    await viewStateStore.set(session.fs.root, key, value);
  });

  // App
  ipcMain.handle(IPC.appSetMenu, (event, spec: MenuSpec) => {
    if (!spec || !Array.isArray(spec.items)) return;
    menuSpecs.set(event.sender.id, spec);
    const focused = BrowserWindow.getFocusedWindow();
    if (!focused || focused.webContents.id === event.sender.id) applyMenu(event.sender.id);
  });
  ipcMain.handle(IPC.appGetSystemDarkMode, () => nativeTheme.shouldUseDarkColors);
  ipcMain.handle(IPC.appGetLocale, () => app.getLocale());
  ipcMain.handle(IPC.appSetWindowTitle, (event, title: string) => {
    BrowserWindow.fromWebContents(event.sender)?.setTitle(String(title ?? ''));
  });
  ipcMain.handle(IPC.appConfirm, async (event, options: ConfirmDialogOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const box: Electron.MessageBoxOptions = {
      type: options.destructive ? 'warning' : 'question',
      message: String(options.message ?? ''),
      buttons: [String(options.confirmLabel ?? 'OK'), String(options.cancelLabel ?? 'Cancel')],
      defaultId: 0,
      cancelId: 1,
    };
    if (options.detail) box.detail = String(options.detail);
    const result = win ? await dialog.showMessageBox(win, box) : await dialog.showMessageBox(box);
    return result.response === 0;
  });
  ipcMain.handle(IPC.appSaveExport, (event, options: SaveDialogOptions, data: string | ArrayBuffer) =>
    toResult(async () => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions: Electron.SaveDialogOptions = {
        title: String(options.title ?? ''),
        defaultPath: String(options.defaultName ?? 'export'),
        filters: Array.isArray(options.filters) ? options.filters : [],
      };
      const result = win ? await dialog.showSaveDialog(win, dialogOptions) : await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, typeof data === 'string' ? data : Buffer.from(toBytes(data)));
      return result.filePath;
    }),
  );
  ipcMain.handle(IPC.appOpenExternal, async (_event, url: string) => {
    if (isAllowedExternal(url)) await shell.openExternal(url);
  });
  ipcMain.handle(IPC.appNewWindow, async (event, path?: RelPath) => {
    const session = sessions.get(event.sender.id);
    let filePath: RelPath | undefined;
    if (typeof path === 'string') {
      try {
        filePath = normalizeRel(path);
      } catch {
        filePath = undefined;
      }
    }
    const seed = session
      ? filePath !== undefined
        ? { workspaceRoot: session.fs.root, filePath }
        : { workspaceRoot: session.fs.root }
      : undefined;
    createWindow(seed);
  });
  ipcMain.on(IPC.appBeforeQuitDone, (event) => {
    flushResolvers.get(event.sender.id)?.();
  });
}

export function isAllowedExternal(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ lifecycle */

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl && url.startsWith(devUrl)) return;
    event.preventDefault();
    if (isAllowedExternal(url)) void shell.openExternal(url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
});

app.on('before-quit', (event) => {
  if (quitFlushed) return;
  event.preventDefault();
  if (quitInProgress) return;
  quitInProgress = true;
  void Promise.all(BrowserWindow.getAllWindows().map((w) => flushWindow(w)))
    .then(() => viewStateStore.flushAll())
    .finally(() => {
      quitFlushed = true;
      app.quit();
    });
});

void app.whenReady().then(async () => {
  setBootstrapMenu();
  registerIpc();
  protocol.handle(ASSET_PROTOCOL, async (request) => {
    const fileUrl = await resolveAssetRequest(
      request.url,
      [...sessions.values()].map((s) => s.fs.root),
    );
    if (!fileUrl) return new Response('Not found', { status: 404 });
    return net.fetch(fileUrl);
  });
  nativeTheme.on('updated', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.webContents.isDestroyed())
        win.webContents.send(IPC.appSystemDarkModeChanged, nativeTheme.shouldUseDarkColors);
    }
  });
  applyThemeSource(await prefsStore.get());
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  void viewStateStore.flushAll();
  if (process.platform !== 'darwin') app.quit();
});

if (isDev) process.on('unhandledRejection', (reason) => console.error(reason));
