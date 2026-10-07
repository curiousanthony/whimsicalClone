/**
 * Document controller: the canvas engine's command layer on top of the host-owned history.
 *
 * Undo/redo belongs to the shell (historyMode "host", SnapshotHistory, SPEC section 7): the
 * canvas never binds edit.undo / edit.redo. What the engine owns is HOW changes reach the
 * host, so that every user action is exactly one undo step:
 *
 *   - `update(recipe, options)`  one command = one onChange (with the selection recorded).
 *   - `begin()` / `preview()` / `commit()` / `cancel()`  a transaction for gestures (drag,
 *     resize, connector drawing): previews render locally without touching history; commit
 *     sends one onChange; cancel (Escape) restores the base document.
 *   - `latest` is updated synchronously so several updates in one handler (create + select +
 *     quick add, afterChange chains) never build on stale props.
 *   - Plugin `afterChange` normalisers run in order before every commit.
 */

import { produce, type Draft } from 'immer';
import type { BoardDocument, ChangeOptions } from '@renderer/core/types';

export type Recipe = (draft: Draft<BoardDocument>) => void;

export interface DocumentControllerOptions {
  /** Host commit (EditorProps.onChange). */
  onCommit(next: BoardDocument, options: ChangeOptions): void;
  /** Called whenever the rendered document changes (commit, preview, cancel, external). */
  onRender?(doc: BoardDocument): void;
  /** Normalisers (plugin afterChange) applied before committing. */
  normalize?(next: BoardDocument, previous: BoardDocument): BoardDocument;
  /** Selection recorded with each committed change (restored on undo/redo). */
  getSelection?(): readonly string[];
}

export class DocumentController {
  private committed: BoardDocument;
  private draft: BoardDocument | undefined;
  private base: BoardDocument | undefined;

  constructor(
    initial: BoardDocument,
    private readonly options: DocumentControllerOptions,
  ) {
    this.committed = initial;
  }

  /** Document to render: the transaction preview when one is running, else the latest commit. */
  get current(): BoardDocument {
    return this.draft ?? this.committed;
  }

  /** Latest committed document (what the host has). */
  get latest(): BoardDocument {
    return this.committed;
  }

  get inTransaction(): boolean {
    return this.base !== undefined;
  }

  /**
   * Host content changed (undo/redo, reload, our own commit echoing back). Our own commits are
   * identical references and are ignored. An external change aborts a running transaction.
   */
  sync(content: BoardDocument): boolean {
    if (content === this.committed) return false;
    this.committed = content;
    if (this.base) {
      this.base = undefined;
      this.draft = undefined;
    }
    this.options.onRender?.(this.current);
    return true;
  }

  /** Applies one command and commits it (no-op when nothing changed). */
  update(recipe: Recipe, options: ChangeOptions = {}): BoardDocument {
    if (this.base) {
      // Inside a transaction, commands extend the preview and are committed together.
      this.preview(recipe);
      return this.current;
    }
    const prev = this.committed;
    const next = produce(prev, recipe);
    this.commitDocument(prev, next, options);
    return this.committed;
  }

  /** Commits a fully built document. */
  replace(next: BoardDocument, options: ChangeOptions = {}): void {
    if (this.base) {
      this.draft = next;
      this.options.onRender?.(this.current);
      return;
    }
    this.commitDocument(this.committed, next, options);
  }

  private commitDocument(prev: BoardDocument, next: BoardDocument, options: ChangeOptions): void {
    if (next === prev) return;
    const normalized = this.options.normalize ? this.options.normalize(next, prev) : next;
    this.committed = normalized;
    const selection = options.selection !== undefined ? options.selection : this.options.getSelection?.();
    const opts: ChangeOptions = { ...options };
    if (selection !== undefined) opts.selection = selection;
    this.options.onCommit(normalized, opts);
    this.options.onRender?.(this.current);
  }

  /** Starts a gesture transaction. Nested begins are ignored. */
  begin(): void {
    if (this.base) return;
    this.base = this.committed;
    this.draft = undefined;
  }

  /** Applies a recipe on top of the current preview (incremental). */
  preview(recipe: Recipe): void {
    if (!this.base) this.begin();
    this.draft = produce(this.draft ?? this.base!, recipe);
    this.options.onRender?.(this.current);
  }

  /**
   * Re-applies a recipe from the transaction base, or from `from` (a document captured during
   * this transaction, e.g. after Alt-drag inserted copies). Absolute: drag delta from start.
   */
  previewFromBase(recipe: Recipe, from?: BoardDocument): void {
    if (!this.base) this.begin();
    this.draft = produce(from ?? this.base!, recipe);
    this.options.onRender?.(this.current);
  }

  /** Base document of the running transaction (the state before the gesture). */
  get transactionBase(): BoardDocument | undefined {
    return this.base;
  }

  /** Ends the transaction, committing the preview as one change (if it changed anything). */
  commit(options: ChangeOptions = {}, finalRecipe?: Recipe): void {
    if (!this.base) return;
    const base = this.base;
    let next = this.draft ?? base;
    if (finalRecipe) next = produce(next, finalRecipe);
    this.base = undefined;
    this.draft = undefined;
    if (next === base) {
      this.options.onRender?.(this.current);
      return;
    }
    this.commitDocument(base, next, options);
  }

  /** Ends the transaction without committing (Escape / pointercancel). */
  cancel(): void {
    if (!this.base) return;
    this.base = undefined;
    this.draft = undefined;
    this.options.onRender?.(this.current);
  }
}

/** Chains plugin afterChange normalisers. */
export function chainNormalizers(
  normalizers: ReadonlyArray<(next: BoardDocument, prev: BoardDocument) => BoardDocument>,
): (next: BoardDocument, prev: BoardDocument) => BoardDocument {
  return (next, prev) => normalizers.reduce((doc, fn) => fn(doc, prev), next);
}
