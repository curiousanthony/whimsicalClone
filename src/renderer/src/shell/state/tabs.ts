/**
 * Tabs of this window (Whimsical desktop: Cmd+T new tab, Cmd+W close, Cmd+1..9, pin,
 * duplicate, close others). Tabs show a file, a folder view, or the "new tab" home page.
 * Persisted per workspace in view state ("tabs") together with recent files ("recent").
 */

import { nanoid } from 'nanoid';
import { create } from 'zustand';
import type { RelPath } from '@shared/ipc';
import { isWithin, rebasePath } from '../tree';
import { ensureDocument, releaseDocument } from './documents';

export type Tab =
  | { id: string; kind: 'file'; path: RelPath; pinned: boolean }
  | { id: string; kind: 'folder'; path: RelPath; pinned: boolean }
  | { id: string; kind: 'home'; pinned: boolean };

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  /** Most recently activated tab ids, newest first (editor LRU mounting). */
  mru: string[];
  /** Recently opened files, newest first. */
  recent: RelPath[];
}

export const useTabs = create<TabsState>()(() => ({ tabs: [], activeId: null, mru: [], recent: [] }));

const MAX_RECENT = 20;

function newId(): string {
  return nanoid(8);
}

export function activeTab(): Tab | undefined {
  const { tabs, activeId } = useTabs.getState();
  return tabs.find((t) => t.id === activeId);
}

export function useActiveTab(): Tab | undefined {
  return useTabs((s) => s.tabs.find((t) => t.id === s.activeId));
}

/** Path of the active file tab, or null. */
export function activeFilePath(): RelPath | null {
  const tab = activeTab();
  return tab?.kind === 'file' ? tab.path : null;
}

function sortPinnedFirst(tabs: Tab[]): Tab[] {
  return [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)];
}

function touchRecent(path: RelPath): void {
  useTabs.setState((s) => ({ recent: [path, ...s.recent.filter((p) => p !== path)].slice(0, MAX_RECENT) }));
}

export function activateTab(id: string): void {
  const tab = useTabs.getState().tabs.find((t) => t.id === id);
  if (!tab) return;
  useTabs.setState((s) => ({ activeId: id, mru: [id, ...s.mru.filter((m) => m !== id)] }));
  if (tab.kind === 'file') {
    void ensureDocument(tab.path);
    touchRecent(tab.path);
  }
  schedulePersist();
}

function insertTab(tab: Tab, afterId: string | null): void {
  useTabs.setState((s) => {
    const tabs = [...s.tabs];
    const index = afterId ? tabs.findIndex((t) => t.id === afterId) : -1;
    tabs.splice(index >= 0 ? index + 1 : tabs.length, 0, tab);
    return { tabs: sortPinnedFirst(tabs) };
  });
  activateTab(tab.id);
}

/** Replaces the content of a tab (navigation inside the tab). */
function replaceTab(id: string, next: Tab): void {
  const previous = useTabs.getState().tabs.find((t) => t.id === id);
  useTabs.setState((s) => ({
    tabs: s.tabs.map((t) => (t.id === id ? next : t)),
    mru: s.mru.map((m) => (m === id ? next.id : m)),
    activeId: s.activeId === id ? next.id : s.activeId,
  }));
  activateTab(next.id);
  if (previous) releaseIfUnused(previous);
}

function releaseIfUnused(tab: Tab): void {
  if (tab.kind !== 'file') return;
  const stillOpen = useTabs.getState().tabs.some((t) => t.kind === 'file' && t.path === tab.path);
  if (!stillOpen) void releaseDocument(tab.path);
}

export interface OpenOptions {
  newTab?: boolean;
}

/** Opens a file: focuses an existing tab, or navigates the current tab / opens a new one. */
export function openFile(path: RelPath, options: OpenOptions = {}): void {
  const { tabs } = useTabs.getState();
  const existing = tabs.find((t) => t.kind === 'file' && t.path === path);
  if (existing && !options.newTab) {
    activateTab(existing.id);
    return;
  }
  navigate({ id: newId(), kind: 'file', path, pinned: false }, options);
}

export function openFolder(path: RelPath, options: OpenOptions = {}): void {
  const current = activeTab();
  if (current?.kind === 'folder' && current.path === path && !options.newTab) return;
  navigate({ id: newId(), kind: 'folder', path, pinned: false }, options);
}

export function openHomeTab(): void {
  insertTab({ id: newId(), kind: 'home', pinned: false }, useTabs.getState().activeId);
}

function navigate(tab: Tab, options: OpenOptions): void {
  const current = activeTab();
  if (!current || options.newTab || current.pinned) insertTab(tab, current?.id ?? null);
  else replaceTab(current.id, tab);
}

/** Closes a tab. Returns false when it was the last one (the caller closes the window). */
export function closeTab(id: string): boolean {
  const { tabs, activeId, mru } = useTabs.getState();
  const index = tabs.findIndex((t) => t.id === id);
  const tab = tabs[index];
  if (!tab) return true;
  if (tabs.length === 1) return false;
  const remaining = tabs.filter((t) => t.id !== id);
  const nextMru = mru.filter((m) => m !== id);
  let nextActive = activeId;
  if (activeId === id) {
    nextActive = remaining[Math.min(index, remaining.length - 1)]?.id ?? null;
  }
  useTabs.setState({ tabs: remaining, mru: nextMru, activeId: nextActive });
  if (nextActive && nextActive !== activeId) activateTab(nextActive);
  releaseIfUnused(tab);
  schedulePersist();
  return true;
}

export function closeOtherTabs(id: string): void {
  const { tabs } = useTabs.getState();
  const closing = tabs.filter((t) => t.id !== id && !t.pinned);
  useTabs.setState((s) => ({
    tabs: s.tabs.filter((t) => t.id === id || t.pinned),
    mru: s.mru.filter((m) => !closing.some((c) => c.id === m)),
  }));
  activateTab(id);
  closing.forEach(releaseIfUnused);
}

export function togglePinTab(id: string): void {
  useTabs.setState((s) => ({
    tabs: sortPinnedFirst(s.tabs.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t))),
  }));
  schedulePersist();
}

export function duplicateTab(id: string): void {
  const tab = useTabs.getState().tabs.find((t) => t.id === id);
  if (!tab) return;
  insertTab({ ...tab, id: newId(), pinned: false }, id);
}

export function moveTab(id: string, toIndex: number): void {
  useTabs.setState((s) => {
    const tabs = [...s.tabs];
    const from = tabs.findIndex((t) => t.id === id);
    if (from < 0) return s;
    const [tab] = tabs.splice(from, 1);
    tabs.splice(Math.max(0, Math.min(toIndex, tabs.length)), 0, tab!);
    return { tabs: sortPinnedFirst(tabs) };
  });
  schedulePersist();
}

export function selectTabByNumber(n: number): void {
  const { tabs } = useTabs.getState();
  const tab = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1];
  if (tab) activateTab(tab.id);
}

export function cycleTab(delta: number): void {
  const { tabs, activeId } = useTabs.getState();
  if (tabs.length < 2) return;
  const index = tabs.findIndex((t) => t.id === activeId);
  const next = tabs[(index + delta + tabs.length) % tabs.length];
  if (next) activateTab(next.id);
}

/** Updates tab paths and recents after an in-app rename/move. */
export function rebaseTabs(from: RelPath, to: RelPath): void {
  useTabs.setState((s) => ({
    tabs: s.tabs.map((t) =>
      t.kind === 'home' || !isWithin(t.path, from) ? t : { ...t, path: rebasePath(t.path, from, to) },
    ),
    recent: s.recent.map((p) => (isWithin(p, from) ? rebasePath(p, from, to) : p)),
  }));
  schedulePersist();
}

/** Removes recents (after trash). Tabs stay open and show the deleted state. */
export function forgetRecent(prefix: RelPath): void {
  useTabs.setState((s) => ({ recent: s.recent.filter((p) => !isWithin(p, prefix)) }));
  schedulePersist();
}

/* ------------------------------------------------------------------ persistence */

interface PersistedTabs {
  tabs: { kind: Tab['kind']; path?: RelPath; pinned?: boolean }[];
  active: number;
}

let persistTimer: number | null = null;

export function schedulePersist(): void {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, 300);
}

export async function persistNow(): Promise<void> {
  const { tabs, activeId, recent } = useTabs.getState();
  const data: PersistedTabs = {
    tabs: tabs.map((t) =>
      t.kind === 'home' ? { kind: 'home', pinned: t.pinned } : { kind: t.kind, path: t.path, pinned: t.pinned },
    ),
    active: Math.max(
      0,
      tabs.findIndex((t) => t.id === activeId),
    ),
  };
  await Promise.all([window.api.viewState.set('tabs', data), window.api.viewState.set('recent', recent)]);
}

/** Restores tabs from view state; falls back to a single home tab. `exists` filters stale paths. */
export async function restoreTabs(
  exists: (path: RelPath, kind: 'file' | 'folder') => boolean,
  options: { skipTabs?: boolean } = {},
): Promise<void> {
  const [saved, recent] = await Promise.all([
    window.api.viewState.get<PersistedTabs>('tabs').catch(() => undefined),
    window.api.viewState.get<RelPath[]>('recent').catch(() => undefined),
  ]);
  const tabs: Tab[] = [];
  let activeIndex = 0;
  if (saved && Array.isArray(saved.tabs) && !options.skipTabs) {
    saved.tabs.forEach((t, i) => {
      if (i === saved.active) activeIndex = tabs.length;
      const pinned = !!t.pinned;
      if (t.kind === 'home') tabs.push({ id: newId(), kind: 'home', pinned });
      else if ((t.kind === 'file' || t.kind === 'folder') && typeof t.path === 'string' && exists(t.path, t.kind)) {
        tabs.push({ id: newId(), kind: t.kind, path: t.path, pinned });
      }
    });
  }
  if (tabs.length === 0) tabs.push({ id: newId(), kind: 'home', pinned: false });
  useTabs.setState({
    tabs: sortPinnedFirst(tabs),
    activeId: null,
    mru: [],
    recent: Array.isArray(recent)
      ? recent.filter((p) => typeof p === 'string' && exists(p, 'file')).slice(0, MAX_RECENT)
      : [],
  });
  const active = tabs[Math.min(activeIndex, tabs.length - 1)];
  if (active) activateTab(active.id);
}

export function resetTabs(): void {
  useTabs.setState({ tabs: [], activeId: null, mru: [], recent: [] });
}
