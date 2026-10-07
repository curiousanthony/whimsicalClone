/**
 * IPC contract between main and renderer. The preload exposes `window.api` implementing
 * `DesktopApi`; main registers one `ipcMain.handle` per INVOKE channel and emits EVENT
 * channels with `webContents.send`.
 *
 * Path rules (enforced in main):
 *   - Every `RelPath` is POSIX, relative to the open workspace root, without a leading "/".
 *     "" is the workspace root itself.
 *   - Main resolves paths with `path.resolve(root, rel)` and rejects any result outside the
 *     root (including via symlinks) with an `IpcError` of code "OUTSIDE_WORKSPACE".
 *   - Hidden entries (names starting with ".") are never listed in the tree.
 */

import type { FileKind } from './fileKinds';
import type { MenuSpec } from './menu';

export type RelPath = string;

/** Stable error codes; the renderer maps them to i18n keys `common:errors.<code>`. */
export type IpcErrorCode =
  | 'NO_WORKSPACE'
  | 'OUTSIDE_WORKSPACE'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'CONFLICT'
  | 'INVALID_NAME'
  | 'IO_ERROR';

/** Results crossing IPC are wrapped so errors keep their code (Error objects lose fields). */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; code: IpcErrorCode; message: string };

export interface TreeNode {
  /** Workspace-relative path ("" for the root). */
  path: RelPath;
  /** File or folder name including extension. */
  name: string;
  type: 'folder' | 'file';
  /** Only for files: document kind, or null for unsupported files (hidden by default). */
  kind?: FileKind | null;
  /** ms since epoch. */
  mtimeMs: number;
  /** Only for folders; sorted folders first then by name (natural, case-insensitive). */
  children?: TreeNode[];
}

export interface FileStat {
  path: RelPath;
  mtimeMs: number;
  size: number;
  /** sha256 hex of the content (files only), used for conflict / echo detection. */
  hash?: string;
}

export interface ReadFileResult {
  content: string;
  stat: FileStat;
}

export interface WriteFileOptions {
  /**
   * If set, main fails with CONFLICT when the file on disk no longer has this hash
   * (somebody else changed it). Omit to overwrite unconditionally.
   */
  expectedHash?: string;
}

export type FsEventType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

export interface FsEvent {
  type: FsEventType;
  path: RelPath;
  /** sha256 of new content for "add"/"change" on files. */
  hash?: string;
  mtimeMs?: number;
}

/** Workspace metadata persisted in `<root>/.whimsical/workspace.json`. */
export interface WorkspaceMeta {
  version: 1;
  /** Starred files/folders (workspace-relative). Main rewrites entries on rename/move. */
  favorites: RelPath[];
  /** Custom icon (lucide name) and colour (palette token) per file. */
  fileIcons: Record<RelPath, { icon?: string; color?: string }>;
  /** Manual sort order of children per folder (names). Missing = default sort. */
  manualOrder: Record<RelPath, string[]>;
}

export type ThemePreference = 'system' | 'light' | 'dark';

/** Per-user preferences persisted in `userData/preferences.json`. */
export interface Preferences {
  theme: ThemePreference;
  /** "system" follows app.getLocale(); otherwise a locale code such as "en" or "fr". */
  language: 'system' | string;
  /** Whimsical "Invert zoom direction" (Preferences > Advanced). */
  invertZoom: boolean;
  /** Freehand "Detect shapes" toggle (remembered). */
  detectShapes: boolean;
  /** Docs per-viewer text size and width (Whimsical defaults: large / narrow). */
  docTextSize: 'small' | 'medium' | 'large';
  docTextWidth: 'narrow' | 'wide';
  sidebarPinned: boolean;
  sidebarWidth: number;
  lastWorkspace: string | null;
  recentWorkspaces: string[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  language: 'system',
  invertZoom: false,
  detectShapes: false,
  docTextSize: 'large',
  docTextWidth: 'narrow',
  sidebarPinned: true,
  sidebarWidth: 260,
  lastWorkspace: null,
  recentWorkspaces: [],
};

export interface WorkspaceInfo {
  /** Absolute path of the workspace root (display only; never send back as a RelPath). */
  rootPath: string;
  name: string;
}

export interface AssetRef {
  /** URL usable in <img src>: `wsasset://<sha256-prefix>.<ext>`. Store this string in documents. */
  url: string;
  mime: string;
  width?: number;
  height?: number;
}

/** Strings main needs for native dialogs; the renderer supplies them already translated. */
export interface ConfirmDialogOptions {
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

export interface SaveDialogOptions {
  title: string;
  defaultName: string;
  filters: { name: string; extensions: string[] }[];
}

export type MenuCommandListener = (commandId: string) => void;
export type FsEventListener = (events: FsEvent[]) => void;
export type Unsubscribe = () => void;

/** The API exposed on `window.api` by the preload script. Everything is async. */
export interface DesktopApi {
  platform: 'darwin' | 'win32' | 'linux';

  workspace: {
    /** Shows the native folder picker; opens the chosen folder as workspace. */
    pick(dialogTitle: string): Promise<IpcResult<WorkspaceInfo | null>>;
    /** Opens a folder (e.g. Preferences.lastWorkspace); starts the watcher. */
    open(absPath: string): Promise<IpcResult<WorkspaceInfo>>;
    current(): Promise<WorkspaceInfo | null>;
    readMeta(): Promise<IpcResult<WorkspaceMeta>>;
    writeMeta(meta: WorkspaceMeta): Promise<IpcResult<void>>;
  };

  fs: {
    /** Full tree of the workspace (folders + all files; hidden entries excluded). */
    listTree(): Promise<IpcResult<TreeNode>>;
    readFile(path: RelPath): Promise<IpcResult<ReadFileResult>>;
    /** Atomic write (temp file + rename). Returns the new stat (with hash). */
    writeFile(path: RelPath, content: string, options?: WriteFileOptions): Promise<IpcResult<FileStat>>;
    /**
     * Creates a new file in `dir` named `<baseName><extension>`, appending " 2", " 3"...
     * if the name is taken. Returns the created path.
     */
    createFile(dir: RelPath, baseName: string, extension: string, content: string): Promise<IpcResult<RelPath>>;
    createFolder(dir: RelPath, baseName: string): Promise<IpcResult<RelPath>>;
    /** Renames in place (newName is a bare name, extension included). Returns the new path. */
    rename(path: RelPath, newName: string): Promise<IpcResult<RelPath>>;
    /** Moves into `destDir` keeping the name (deduplicated). Returns the new path. */
    move(path: RelPath, destDir: RelPath): Promise<IpcResult<RelPath>>;
    /** Copies next to the original (" copy" suffix) or into destDir. Returns the new path. */
    duplicate(path: RelPath, destDir?: RelPath): Promise<IpcResult<RelPath>>;
    /** Moves to the macOS Trash (shell.trashItem). Never deletes permanently. */
    trash(path: RelPath): Promise<IpcResult<void>>;
    stat(path: RelPath): Promise<IpcResult<FileStat>>;
    revealInFinder(path: RelPath): Promise<void>;
    /** Subscribe to batched watcher events (debounced ~50 ms, own writes filtered out). */
    onEvents(listener: FsEventListener): Unsubscribe;
  };

  assets: {
    /** Stores bytes content-addressed in `.whimsical/assets/` and returns its URL. */
    importBytes(name: string, bytes: ArrayBuffer): Promise<IpcResult<AssetRef>>;
    /** Same, from an absolute file path (drag-and-drop from Finder). */
    importFile(absPath: string): Promise<IpcResult<AssetRef>>;
    /** Absolute path of a dropped File (wraps webUtils.getPathForFile). */
    getPathForFile(file: File): string;
  };

  prefs: {
    get(): Promise<Preferences>;
    set(patch: Partial<Preferences>): Promise<Preferences>;
    onChange(listener: (prefs: Preferences) => void): Unsubscribe;
  };

  /**
   * Per-viewer state that must not live in documents (open tabs, viewports, doc collapse
   * state, recents). Stored in userData, keyed by workspace root.
   */
  viewState: {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
  };

  app: {
    /** Replaces the native menu bar. Labels already translated, accelerators from registry. */
    setMenu(spec: MenuSpec): Promise<void>;
    onMenuCommand(listener: MenuCommandListener): Unsubscribe;
    /** System dark mode (nativeTheme.shouldUseDarkColors) and its changes. */
    getSystemDarkMode(): Promise<boolean>;
    onSystemDarkModeChange(listener: (dark: boolean) => void): Unsubscribe;
    /** System locale (app.getLocale()). */
    getLocale(): Promise<string>;
    setWindowTitle(title: string): Promise<void>;
    confirm(options: ConfirmDialogOptions): Promise<boolean>;
    /** Shows a save dialog and writes the data there. Returns the absolute path or null. */
    saveExport(options: SaveDialogOptions, data: string | ArrayBuffer): Promise<IpcResult<string | null>>;
    openExternal(url: string): Promise<void>;
    /** Opens a new BrowserWindow, optionally on a file of the current workspace. */
    newWindow(path?: RelPath): Promise<void>;
    /**
     * Main asks the renderer to flush pending autosaves before quitting/closing.
     * The listener must resolve when all writes completed.
     */
    onBeforeQuit(listener: () => Promise<void>): Unsubscribe;
  };
}

/** Channel names. INVOKE = renderer -> main (handle), EVENT = main -> renderer (send). */
export const IPC = {
  workspacePick: 'workspace:pick',
  workspaceOpen: 'workspace:open',
  workspaceCurrent: 'workspace:current',
  workspaceReadMeta: 'workspace:readMeta',
  workspaceWriteMeta: 'workspace:writeMeta',

  fsListTree: 'fs:listTree',
  fsReadFile: 'fs:readFile',
  fsWriteFile: 'fs:writeFile',
  fsCreateFile: 'fs:createFile',
  fsCreateFolder: 'fs:createFolder',
  fsRename: 'fs:rename',
  fsMove: 'fs:move',
  fsDuplicate: 'fs:duplicate',
  fsTrash: 'fs:trash',
  fsStat: 'fs:stat',
  fsReveal: 'fs:reveal',
  fsEvents: 'fs:events', // EVENT

  assetsImportBytes: 'assets:importBytes',
  assetsImportFile: 'assets:importFile',

  prefsGet: 'prefs:get',
  prefsSet: 'prefs:set',
  prefsChanged: 'prefs:changed', // EVENT

  viewStateGet: 'viewState:get',
  viewStateSet: 'viewState:set',

  appSetMenu: 'app:setMenu',
  appMenuCommand: 'app:menuCommand', // EVENT
  appGetSystemDarkMode: 'app:getSystemDarkMode',
  appSystemDarkModeChanged: 'app:systemDarkModeChanged', // EVENT
  appGetLocale: 'app:getLocale',
  appSetWindowTitle: 'app:setWindowTitle',
  appConfirm: 'app:confirm',
  appSaveExport: 'app:saveExport',
  appOpenExternal: 'app:openExternal',
  appNewWindow: 'app:newWindow',
  appBeforeQuit: 'app:beforeQuit', // EVENT
  appBeforeQuitDone: 'app:beforeQuitDone', // renderer -> main (send)
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
