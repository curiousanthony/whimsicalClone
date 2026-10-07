/**
 * Small JSON persistence helpers for userData files: preferences (immediate) and per-workspace
 * view state (debounced).
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/ipc';
import { atomicWrite } from './workspaceFs';

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

/** Keeps only known preference keys with the right primitive type. */
export function sanitizePreferences(input: unknown, base: Preferences = DEFAULT_PREFERENCES): Preferences {
  const out: Preferences = { ...base, recentWorkspaces: [...base.recentWorkspaces] };
  if (!input || typeof input !== 'object') return out;
  const src = input as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof Preferences)[]) {
    const value = src[key];
    const def = DEFAULT_PREFERENCES[key];
    if (value === undefined) continue;
    if (key === 'recentWorkspaces') {
      if (Array.isArray(value))
        out.recentWorkspaces = value.filter((v): v is string => typeof v === 'string').slice(0, 10);
    } else if (key === 'lastWorkspace') {
      if (value === null || typeof value === 'string') out.lastWorkspace = value;
    } else if (key === 'theme') {
      if (value === 'system' || value === 'light' || value === 'dark') out.theme = value;
    } else if (key === 'docTextSize') {
      if (value === 'small' || value === 'medium' || value === 'large') out.docTextSize = value;
    } else if (key === 'docTextWidth') {
      if (value === 'narrow' || value === 'wide') out.docTextWidth = value;
    } else if (key === 'sidebarWidth') {
      if (typeof value === 'number' && Number.isFinite(value))
        out.sidebarWidth = Math.min(560, Math.max(180, Math.round(value)));
    } else if (typeof value === typeof def) {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

export class PreferencesStore {
  private prefs: Preferences = { ...DEFAULT_PREFERENCES };
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async get(): Promise<Preferences> {
    if (!this.loaded) {
      this.prefs = sanitizePreferences(await readJson(this.file));
      this.loaded = true;
    }
    return this.prefs;
  }

  async set(patch: Partial<Preferences>): Promise<Preferences> {
    const current = await this.get();
    this.prefs = sanitizePreferences({ ...current, ...patch }, current);
    const snapshot = this.prefs;
    const job = this.queue.then(() => atomicWrite(this.file, `${JSON.stringify(snapshot, null, 2)}\n`));
    this.queue = job.catch(() => undefined);
    await job;
    return this.prefs;
  }

  /** Records an opened workspace as last and most recent. */
  async recordWorkspace(rootPath: string): Promise<Preferences> {
    const current = await this.get();
    const recent = [rootPath, ...current.recentWorkspaces.filter((p) => p !== rootPath)].slice(0, 10);
    return this.set({ lastWorkspace: rootPath, recentWorkspaces: recent });
  }
}

/** Per-workspace view state: `userData/view-state/<sha1(root)>.json`, debounced writes. */
export class ViewStateStore {
  private readonly cache = new Map<string, Record<string, unknown>>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly dir: string) {}

  private fileFor(root: string): string {
    return path.join(this.dir, `${createHash('sha1').update(root).digest('hex')}.json`);
  }

  private async load(root: string): Promise<Record<string, unknown>> {
    let state = this.cache.get(root);
    if (!state) {
      const read = await readJson<Record<string, unknown>>(this.fileFor(root));
      state = read && typeof read === 'object' && !Array.isArray(read) ? read : {};
      this.cache.set(root, state);
    }
    return state;
  }

  async get(root: string, key: string): Promise<unknown> {
    return (await this.load(root))[key];
  }

  async set(root: string, key: string, value: unknown): Promise<void> {
    const state = await this.load(root);
    if (value === undefined || value === null) delete state[key];
    else state[key] = value;
    const existing = this.timers.get(root);
    if (existing) clearTimeout(existing);
    this.timers.set(
      root,
      setTimeout(() => void this.write(root), 400),
    );
  }

  private async write(root: string): Promise<void> {
    this.timers.delete(root);
    const state = this.cache.get(root);
    if (!state) return;
    try {
      await atomicWrite(this.fileFor(root), `${JSON.stringify(state)}\n`);
    } catch {
      // userData not writable: view state is best effort.
    }
  }

  async flushAll(): Promise<void> {
    const roots = [...this.timers.keys()];
    for (const root of roots) {
      const t = this.timers.get(root);
      if (t) clearTimeout(t);
    }
    await Promise.all(roots.map((r) => this.write(r)));
  }
}
