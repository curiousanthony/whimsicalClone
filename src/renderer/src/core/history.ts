/**
 * Snapshot undo history used by the shell for every editor with historyMode "host".
 *
 * Documents are immutable (immer), so storing before/after references is cheap thanks to
 * structural sharing. Changes sharing a coalesceKey within `coalesceMs` merge into one step.
 */

import type { ChangeOptions } from './types';

export interface HistoryEntry<T> {
  before: T;
  after: T;
  coalesceKey?: string;
  time: number;
  /** Selection recorded with the change (ChangeOptions.selection). */
  selection?: unknown;
}

export interface SnapshotHistoryOptions {
  limit?: number;
  coalesceMs?: number;
  now?: () => number;
}

export class SnapshotHistory<T> {
  private undoStack: HistoryEntry<T>[] = [];
  private redoStack: HistoryEntry<T>[] = [];
  private readonly limit: number;
  private readonly coalesceMs: number;
  private readonly now: () => number;

  constructor(options: SnapshotHistoryOptions = {}) {
    this.limit = options.limit ?? 200;
    this.coalesceMs = options.coalesceMs ?? 1000;
    this.now = options.now ?? (() => Date.now());
  }

  /** Records a committed change from `before` to `after`. */
  record(before: T, after: T, options: ChangeOptions = {}): void {
    if (options.history === 'skip' || before === after) return;
    this.redoStack = [];
    const time = this.now();
    const top = this.undoStack[this.undoStack.length - 1];
    if (options.coalesceKey && top && top.coalesceKey === options.coalesceKey && time - top.time <= this.coalesceMs) {
      top.after = after;
      top.time = time;
      if (options.selection !== undefined) top.selection = options.selection;
      return;
    }
    const entry: HistoryEntry<T> = { before, after, time };
    if (options.coalesceKey !== undefined) entry.coalesceKey = options.coalesceKey;
    if (options.selection !== undefined) entry.selection = options.selection;
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
  }

  /** Returns the entry to undo; the caller restores `entry.before`. */
  undo(): HistoryEntry<T> | undefined {
    const entry = this.undoStack.pop();
    if (entry) this.redoStack.push(entry);
    return entry;
  }

  /** Returns the entry to redo; the caller restores `entry.after`. */
  redo(): HistoryEntry<T> | undefined {
    const entry = this.redoStack.pop();
    if (entry) this.undoStack.push(entry);
    return entry;
  }

  /** Stops coalescing with the previous step (e.g. after a blur or a tool change). */
  seal(): void {
    const top = this.undoStack[this.undoStack.length - 1];
    if (top) delete top.coalesceKey;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
