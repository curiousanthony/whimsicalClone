/**
 * Workspace watcher: chokidar on the root, ignoring hidden entries (".whimsical", temp files
 * of atomic writes, dot-files), batching events (~50 ms) and dropping echoes of the app's own
 * writes (same hash written within the last 2 s).
 */

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { FsEvent, FsEventType } from '@shared/ipc';
import { sha256, toRel } from './paths';

const ECHO_WINDOW_MS = 2000;
const BATCH_MS = 50;
const MAX_HASH_BYTES = 64 * 1024 * 1024;

/** True when any segment of `rel` (relative to the root) is hidden. */
export function isHiddenRel(rel: string): boolean {
  return rel.split('/').some((segment) => segment.startsWith('.'));
}

/** Remembers hashes of files written by the app so the watcher can drop their echoes. */
export class EchoFilter {
  private readonly writes = new Map<string, { hash: string; until: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  record(rel: string, hash: string): void {
    this.writes.set(rel, { hash, until: this.now() + ECHO_WINDOW_MS });
  }

  /** True when an add/change event with this hash is our own write. */
  isEcho(rel: string, hash: string | undefined): boolean {
    const entry = this.writes.get(rel);
    if (!entry) return false;
    if (entry.until < this.now()) {
      this.writes.delete(rel);
      return false;
    }
    return hash !== undefined && entry.hash === hash;
  }
}

export interface WorkspaceWatcher {
  close(): Promise<void>;
}

/** Starts watching `root` and calls `emit` with batched events. */
export async function startWatcher(
  root: string,
  echo: EchoFilter,
  emit: (events: FsEvent[]) => void,
): Promise<WorkspaceWatcher> {
  // chokidar 5 is ESM-only; a dynamic import keeps the CJS main bundle loadable.
  const { watch } = await import('chokidar');
  const watcher = watch(root, {
    ignoreInitial: true,
    followSymlinks: false,
    ignored: (p: string) => {
      const rel = toRel(root, p);
      return rel !== '' && isHiddenRel(rel);
    },
    awaitWriteFinish: false,
  });

  let pending: { type: FsEventType; abs: string }[] = [];
  let timer: NodeJS.Timeout | null = null;

  const flush = async () => {
    timer = null;
    const batch = pending;
    pending = [];
    // Keep only the last event per path, in arrival order.
    const last = new Map<string, FsEventType>();
    for (const e of batch) {
      last.delete(e.abs);
      last.set(e.abs, e.type);
    }
    const out: FsEvent[] = [];
    for (const [abs, type] of last) {
      const rel = toRel(root, abs);
      if (rel === '' || rel.startsWith('..')) continue;
      const event: FsEvent = { type, path: rel };
      if (type === 'add' || type === 'change') {
        try {
          const s = await stat(abs);
          event.mtimeMs = s.mtimeMs;
          if (s.size <= MAX_HASH_BYTES) event.hash = sha256(await readFile(abs));
        } catch {
          continue; // vanished in the meantime; an unlink will follow
        }
        if (echo.isEcho(rel, event.hash)) continue;
      }
      out.push(event);
    }
    if (out.length > 0) emit(out);
  };

  const push = (type: FsEventType) => (abs: string) => {
    pending.push({ type, abs: path.resolve(abs) });
    if (!timer) timer = setTimeout(() => void flush(), BATCH_MS);
  };
  watcher.on('add', push('add'));
  watcher.on('change', push('change'));
  watcher.on('unlink', push('unlink'));
  watcher.on('addDir', push('addDir'));
  watcher.on('unlinkDir', push('unlinkDir'));
  watcher.on('error', () => undefined);

  return {
    close: async () => {
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
