/**
 * File-system operations of one open workspace (pure Node; Electron-only features such as
 * the Trash are injected). Every RelPath is validated with ./paths before touching disk.
 */

import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access, cp, lstat, mkdir, open, readdir, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { kindFromPath, WORKSPACE_META_DIR } from '@shared/fileKinds';
import type { FileStat, ReadFileResult, RelPath, TreeNode, WorkspaceMeta, WriteFileOptions } from '@shared/ipc';
import { IpcError } from './errors';
import {
  assertValidName,
  baseNameOf,
  dedupeName,
  isInside,
  isSameOrDescendant,
  joinRel,
  naturalCompare,
  normalizeRel,
  parentOf,
  resolveExisting,
  resolveForCreate,
  rewritePath,
  sha256,
  splitName,
  toRel,
} from './paths';

export const EMPTY_META: WorkspaceMeta = { version: 1, favorites: [], fileIcons: {}, manualOrder: {} };

export interface WorkspaceFsOptions {
  /** Moves an absolute path to the OS trash (Electron shell.trashItem in production). */
  trash: (absPath: string) => Promise<void>;
  /** Called after every write done by the app (echo suppression in the watcher). */
  onOwnWrite?: (rel: RelPath, hash: string) => void;
}

async function exists(abs: string): Promise<boolean> {
  try {
    await access(abs, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Writes atomically: temp file in the same folder, fsync, rename over the target. */
export async function atomicWrite(abs: string, data: string | Uint8Array): Promise<void> {
  const dir = path.dirname(abs);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(abs)}.tmp-${randomBytes(6).toString('hex')}`);
  const handle = await open(tmp, 'w');
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(tmp, abs);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

export class WorkspaceFs {
  readonly root: string;
  private metaCache: WorkspaceMeta | null = null;
  private metaQueue: Promise<unknown> = Promise.resolve();

  /** `root` must already be a realpath. Use `WorkspaceFs.open` to validate a folder. */
  constructor(
    root: string,
    private readonly options: WorkspaceFsOptions,
  ) {
    this.root = root;
  }

  /** Validates that `absPath` is an existing directory and returns a WorkspaceFs on its realpath. */
  static async open(absPath: string, options: WorkspaceFsOptions): Promise<WorkspaceFs> {
    if (typeof absPath !== 'string' || !path.isAbsolute(absPath))
      throw new IpcError('NOT_FOUND', 'Workspace path must be absolute');
    let real: string;
    try {
      real = await realpath(absPath);
    } catch {
      throw new IpcError('NOT_FOUND', `Folder not found: ${absPath}`);
    }
    const s = await stat(real);
    if (!s.isDirectory()) throw new IpcError('NOT_FOUND', `Not a folder: ${absPath}`);
    return new WorkspaceFs(real, options);
  }

  /* ------------------------------------------------------------------ tree */

  async listTree(): Promise<TreeNode> {
    const rootStat = await stat(this.root);
    return {
      path: '',
      name: path.basename(this.root),
      type: 'folder',
      mtimeMs: rootStat.mtimeMs,
      children: await this.listDir(''),
    };
  }

  private async listDir(rel: RelPath): Promise<TreeNode[]> {
    const abs = rel === '' ? this.root : path.join(this.root, ...rel.split('/'));
    let entries;
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return [];
    }
    const nodes: TreeNode[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const childRel = joinRel(rel, entry.name);
      const childAbs = path.join(abs, entry.name);
      try {
        if (entry.isSymbolicLink()) {
          // Symlinked files are listed only if they stay inside the workspace; symlinked
          // folders are skipped to avoid cycles.
          const real = await realpath(childAbs);
          if (!isInside(this.root, real)) continue;
          const s = await stat(real);
          if (!s.isFile()) continue;
          nodes.push({
            path: childRel,
            name: entry.name,
            type: 'file',
            kind: kindFromPath(entry.name),
            mtimeMs: s.mtimeMs,
          });
        } else if (entry.isDirectory()) {
          const s = await lstat(childAbs);
          nodes.push({
            path: childRel,
            name: entry.name,
            type: 'folder',
            mtimeMs: s.mtimeMs,
            children: await this.listDir(childRel),
          });
        } else if (entry.isFile()) {
          const s = await lstat(childAbs);
          nodes.push({
            path: childRel,
            name: entry.name,
            type: 'file',
            kind: kindFromPath(entry.name),
            mtimeMs: s.mtimeMs,
          });
        }
      } catch {
        // Entry vanished while listing: ignore.
      }
    }
    nodes.sort((a, b) => (a.type === b.type ? naturalCompare(a.name, b.name) : a.type === 'folder' ? -1 : 1));
    return nodes;
  }

  /* ------------------------------------------------------------------ files */

  async readFile(rel: RelPath): Promise<ReadFileResult> {
    const abs = await resolveExisting(this.root, rel);
    const buffer = await readFile(abs);
    const s = await stat(abs);
    if (!s.isFile()) throw new IpcError('NOT_FOUND', `Not a file: ${rel}`);
    return {
      content: buffer.toString('utf8'),
      stat: { path: normalizeRel(rel), mtimeMs: s.mtimeMs, size: s.size, hash: sha256(buffer) },
    };
  }

  async stat(rel: RelPath): Promise<FileStat> {
    const abs = await resolveExisting(this.root, rel);
    const s = await stat(abs);
    const out: FileStat = { path: normalizeRel(rel), mtimeMs: s.mtimeMs, size: s.size };
    if (s.isFile()) out.hash = sha256(await readFile(abs));
    return out;
  }

  async writeFile(rel: RelPath, content: string, options: WriteFileOptions = {}): Promise<FileStat> {
    const clean = normalizeRel(rel);
    if (clean === '' || clean.split('/').some((s) => s.startsWith('.'))) {
      throw new IpcError('INVALID_NAME', `Cannot write to ${rel}`);
    }
    // Recreate missing parent folders (a folder deleted under an open tab), inside the root.
    const parentRel = parentOf(clean);
    await this.ensureFolder(parentRel);
    const abs = await resolveForCreate(this.root, clean);
    if (options.expectedHash !== undefined && (await exists(abs))) {
      const current = sha256(await readFile(abs));
      if (current !== options.expectedHash) throw new IpcError('CONFLICT', `${rel} changed on disk`);
    }
    const data = Buffer.from(content, 'utf8');
    const hash = sha256(data);
    this.options.onOwnWrite?.(clean, hash);
    await atomicWrite(abs, data);
    const s = await stat(abs);
    return { path: clean, mtimeMs: s.mtimeMs, size: s.size, hash };
  }

  /** Creates missing folders of `rel` one segment at a time, checking containment each step. */
  private async ensureFolder(rel: RelPath): Promise<void> {
    if (rel === '') return;
    let current = '';
    for (const segment of rel.split('/')) {
      assertValidName(segment);
      const next = joinRel(current, segment);
      const abs = await resolveForCreate(this.root, next);
      if (!(await exists(abs))) await mkdir(abs);
      await resolveExisting(this.root, next);
      current = next;
    }
  }

  private async freeName(dirRel: RelPath, base: string, ext: string): Promise<string> {
    const dirAbs = await resolveExisting(this.root, dirRel);
    const taken = new Set((await readdir(dirAbs)).map((n) => n.toLowerCase()));
    return dedupeName(base, ext, async (name) => taken.has(name.toLowerCase()));
  }

  async createFile(dir: RelPath, baseName: string, extension: string, content: string): Promise<RelPath> {
    assertValidName(baseName);
    if (extension !== '' && !/^\.[A-Za-z0-9]{1,16}$/.test(extension))
      throw new IpcError('INVALID_NAME', `Bad extension ${extension}`);
    const dirRel = normalizeRel(dir);
    const name = await this.freeName(dirRel, baseName, extension);
    const rel = joinRel(dirRel, name);
    const abs = await resolveForCreate(this.root, rel);
    const data = Buffer.from(content, 'utf8');
    this.options.onOwnWrite?.(rel, sha256(data));
    await atomicWrite(abs, data);
    return rel;
  }

  async createFolder(dir: RelPath, baseName: string): Promise<RelPath> {
    assertValidName(baseName);
    const dirRel = normalizeRel(dir);
    const name = await this.freeName(dirRel, baseName, '');
    const rel = joinRel(dirRel, name);
    await mkdir(await resolveForCreate(this.root, rel));
    return rel;
  }

  async rename(rel: RelPath, newName: string): Promise<RelPath> {
    const from = normalizeRel(rel);
    if (from === '') throw new IpcError('INVALID_NAME', 'Cannot rename the workspace root');
    assertValidName(newName);
    const fromAbs = await resolveExisting(this.root, from);
    const to = joinRel(parentOf(from), newName);
    if (to === from) return from;
    const toAbs = await resolveForCreate(this.root, to);
    const caseOnly = to.toLowerCase() === from.toLowerCase();
    if (!caseOnly && (await exists(toAbs))) throw new IpcError('ALREADY_EXISTS', `${newName} already exists`);
    await rename(fromAbs, toAbs);
    await this.rewriteMeta(from, to);
    return to;
  }

  async move(rel: RelPath, destDir: RelPath): Promise<RelPath> {
    const from = normalizeRel(rel);
    const dest = normalizeRel(destDir);
    if (from === '') throw new IpcError('INVALID_NAME', 'Cannot move the workspace root');
    if (isSameOrDescendant(dest, from)) throw new IpcError('INVALID_NAME', 'Cannot move a folder into itself');
    if (parentOf(from) === dest) return from;
    const fromAbs = await resolveExisting(this.root, from);
    const destAbs = await resolveExisting(this.root, dest);
    if (!(await stat(destAbs)).isDirectory()) throw new IpcError('NOT_FOUND', `${destDir} is not a folder`);
    const [base, ext] = await this.splitForDedupe(fromAbs, baseNameOf(from));
    const name = await this.freeName(dest, base, ext);
    const to = joinRel(dest, name);
    await rename(fromAbs, await resolveForCreate(this.root, to));
    await this.rewriteMeta(from, to);
    return to;
  }

  async duplicate(rel: RelPath, destDir?: RelPath): Promise<RelPath> {
    const from = normalizeRel(rel);
    if (from === '') throw new IpcError('INVALID_NAME', 'Cannot duplicate the workspace root');
    const fromAbs = await resolveExisting(this.root, from);
    const dest = destDir === undefined ? parentOf(from) : normalizeRel(destDir);
    if (isSameOrDescendant(dest, from)) throw new IpcError('INVALID_NAME', 'Cannot copy a folder into itself');
    const [base, ext] = await this.splitForDedupe(fromAbs, baseNameOf(from));
    const name = await this.freeName(dest, destDir === undefined ? `${base} copy` : base, ext);
    const to = joinRel(dest, name);
    const toAbs = await resolveForCreate(this.root, to);
    const s = await stat(fromAbs);
    if (s.isDirectory()) {
      await cp(fromAbs, toAbs, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
    } else {
      const data = await readFile(fromAbs);
      this.options.onOwnWrite?.(to, sha256(data));
      await atomicWrite(toAbs, data);
    }
    return to;
  }

  async trash(rel: RelPath): Promise<void> {
    const clean = normalizeRel(rel);
    if (clean === '') throw new IpcError('INVALID_NAME', 'Cannot delete the workspace root');
    const abs = await resolveExisting(this.root, clean);
    await this.options.trash(abs);
    await this.rewriteMeta(clean, null);
  }

  /** Folders keep their whole name; files split off their extension for " 2" suffixes. */
  private async splitForDedupe(abs: string, name: string): Promise<[string, string]> {
    const s = await stat(abs);
    return s.isDirectory() ? [name, ''] : splitName(name);
  }

  /** Absolute path for reveal-in-Finder (validated). */
  async absolute(rel: RelPath): Promise<string> {
    return resolveExisting(this.root, rel);
  }

  /* ------------------------------------------------------------------ metadata */

  private get metaPath(): string {
    return path.join(this.root, WORKSPACE_META_DIR, 'workspace.json');
  }

  async readMeta(): Promise<WorkspaceMeta> {
    if (this.metaCache) return this.metaCache;
    try {
      const parsed = JSON.parse(await readFile(this.metaPath, 'utf8')) as Partial<WorkspaceMeta>;
      this.metaCache = {
        version: 1,
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((p) => typeof p === 'string') : [],
        fileIcons: parsed.fileIcons && typeof parsed.fileIcons === 'object' ? parsed.fileIcons : {},
        manualOrder: parsed.manualOrder && typeof parsed.manualOrder === 'object' ? parsed.manualOrder : {},
      };
    } catch {
      this.metaCache = structuredClone(EMPTY_META);
    }
    return this.metaCache;
  }

  async writeMeta(meta: WorkspaceMeta): Promise<void> {
    const sanitized: WorkspaceMeta = {
      version: 1,
      favorites: [...new Set(meta.favorites.map((p) => normalizeRel(p)))],
      fileIcons: Object.fromEntries(Object.entries(meta.fileIcons).map(([k, v]) => [normalizeRel(k), v])),
      manualOrder: Object.fromEntries(Object.entries(meta.manualOrder).map(([k, v]) => [normalizeRel(k), v])),
    };
    this.metaCache = sanitized;
    const job = this.metaQueue.then(() => atomicWrite(this.metaPath, `${JSON.stringify(sanitized, null, 2)}\n`));
    this.metaQueue = job.catch(() => undefined);
    await job;
  }

  /** Rewrites favourites, icons and manual order after a rename/move (`to`) or delete (null). */
  async rewriteMeta(from: RelPath, to: RelPath | null): Promise<void> {
    const meta = await this.readMeta();
    let changed = false;
    const map = (p: string): string | null => {
      const next = rewritePath(p, from, to ?? '\0');
      if (next === null) return p;
      changed = true;
      return to === null ? null : next;
    };
    const favorites = meta.favorites.map(map).filter((p): p is string => p !== null);
    const fileIcons: WorkspaceMeta['fileIcons'] = {};
    for (const [k, v] of Object.entries(meta.fileIcons)) {
      const nk = map(k);
      if (nk !== null) fileIcons[nk] = v;
    }
    const manualOrder: WorkspaceMeta['manualOrder'] = {};
    for (const [k, v] of Object.entries(meta.manualOrder)) {
      const nk = map(k);
      if (nk !== null) manualOrder[nk] = v;
    }
    // Keep the entry name in its parent's manual order.
    const fromParent = parentOf(from);
    const order = manualOrder[fromParent];
    if (order) {
      const i = order.indexOf(baseNameOf(from));
      if (i >= 0) {
        changed = true;
        const next = [...order];
        if (to !== null && parentOf(to) === fromParent) next[i] = baseNameOf(to);
        else next.splice(i, 1);
        manualOrder[fromParent] = next;
      }
    }
    if (changed) await this.writeMeta({ version: 1, favorites, fileIcons, manualOrder });
  }
}
