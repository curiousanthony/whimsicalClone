/**
 * Undo / redo integration: the canvas DocumentController commits one change per command or
 * gesture into the host's SnapshotHistory (core/history.ts), with the selection recorded.
 */

import { describe, expect, it } from 'vitest';
import { SnapshotHistory } from '@renderer/core/history';
import type { BoardDocument, ChangeOptions, ShapeElement } from '@renderer/core/types';
import { DocumentController, chainNormalizers } from './documentController';
import { board, shape } from './testUtils';

function setup(selection: string[] = []) {
  let time = 0;
  const history = new SnapshotHistory<BoardDocument>({ now: () => time });
  const commits: Array<{ doc: BoardDocument; options: ChangeOptions }> = [];
  const renders: BoardDocument[] = [];
  let hostContent = board([shape('a', 0, 0)]);
  const controller = new DocumentController(hostContent, {
    onCommit(next, options) {
      history.record(hostContent, next, options);
      hostContent = next;
      commits.push({ doc: next, options });
    },
    onRender: (doc) => renders.push(doc),
    getSelection: () => selection,
  });
  return {
    controller,
    history,
    commits,
    renders,
    tick: (ms: number) => (time += ms),
    host: () => hostContent,
    /** Simulates the shell applying undo/redo and passing new content back. */
    applyFromHost(doc: BoardDocument) {
      hostContent = doc;
      controller.sync(doc);
    },
  };
}

const xOf = (doc: BoardDocument, id = 'a') => (doc.elements.find((e) => e.id === id) as ShapeElement).x;

describe('DocumentController + host history', () => {
  it('commits one undo step per command and records the selection', () => {
    const t = setup(['a']);
    t.controller.update((d) => {
      (d.elements[0] as ShapeElement).x = 10;
    });
    expect(t.commits).toHaveLength(1);
    expect(t.commits[0]!.options.selection).toEqual(['a']);
    expect(xOf(t.controller.latest)).toBe(10);
    const entry = t.history.undo()!;
    expect(xOf(entry.before)).toBe(0);
    expect(entry.selection).toEqual(['a']);
  });

  it('ignores no-op updates', () => {
    const t = setup();
    t.controller.update(() => {});
    expect(t.commits).toHaveLength(0);
  });

  it('chains updates synchronously (no stale props)', () => {
    const t = setup();
    t.controller.update((d) => {
      d.elements.push(shape('b', 100, 0));
    });
    t.controller.update((d) => {
      d.elements.push(shape('c', 200, 0));
    });
    expect(t.controller.latest.elements.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(t.history.undo()!.after.elements).toHaveLength(3);
    expect(t.history.undo()!.before.elements).toHaveLength(1);
  });

  it('collapses a drag gesture into one step and previews without committing', () => {
    const t = setup(['a']);
    t.controller.begin();
    for (const dx of [5, 10, 30]) {
      t.controller.previewFromBase((d) => {
        (d.elements[0] as ShapeElement).x += dx;
      });
    }
    expect(t.commits).toHaveLength(0);
    expect(xOf(t.controller.current)).toBe(30);
    expect(xOf(t.controller.latest)).toBe(0);
    t.controller.commit();
    expect(t.commits).toHaveLength(1);
    expect(xOf(t.host())).toBe(30);
    expect(xOf(t.history.undo()!.before)).toBe(0);
    expect(t.history.canUndo()).toBe(false);
  });

  it('cancels a gesture with Escape (nothing recorded)', () => {
    const t = setup();
    t.controller.begin();
    t.controller.preview((d) => {
      (d.elements[0] as ShapeElement).x = 99;
    });
    t.controller.cancel();
    expect(t.commits).toHaveLength(0);
    expect(xOf(t.controller.current)).toBe(0);
    expect(t.renders.at(-1)).toBe(t.controller.latest);
  });

  it('routes commands issued during a transaction into the same step', () => {
    const t = setup();
    t.controller.begin();
    t.controller.update((d) => {
      (d.elements[0] as ShapeElement).x = 1;
    });
    t.controller.update((d) => {
      (d.elements[0] as ShapeElement).y = 2;
    });
    t.controller.commit();
    expect(t.commits).toHaveLength(1);
    expect((t.host().elements[0] as ShapeElement).y).toBe(2);
  });

  it('coalesces typing with a coalesceKey', () => {
    const t = setup();
    for (const x of [1, 2, 3]) {
      t.tick(100);
      t.controller.update(
        (d) => {
          (d.elements[0] as ShapeElement).x = x;
        },
        { coalesceKey: 'text:a' },
      );
    }
    expect(t.commits).toHaveLength(3);
    const entry = t.history.undo()!;
    expect(xOf(entry.before)).toBe(0);
    expect(xOf(entry.after)).toBe(3);
    expect(t.history.canUndo()).toBe(false);
  });

  it('accepts undo / redo content from the host and aborts a running gesture', () => {
    const t = setup();
    t.controller.update((d) => {
      (d.elements[0] as ShapeElement).x = 50;
    });
    const entry = t.history.undo()!;
    t.controller.begin();
    t.controller.preview((d) => {
      (d.elements[0] as ShapeElement).x = 999;
    });
    t.applyFromHost(entry.before);
    expect(t.controller.inTransaction).toBe(false);
    expect(xOf(t.controller.current)).toBe(0);
    // Our own commit echoed back is ignored.
    expect(t.controller.sync(t.controller.latest)).toBe(false);
    const redo = t.history.redo()!;
    t.applyFromHost(redo.after);
    expect(xOf(t.controller.current)).toBe(50);
  });

  it('runs plugin normalisers before committing', () => {
    let committed: BoardDocument | undefined;
    const normalize = chainNormalizers([
      (next) => ({ ...next, settings: { ...next.settings, nextAnnotationNumber: 7 } }),
      (next, prev) => (next.elements.length > prev.elements.length ? { ...next, kind: 'flowchart' } : next),
    ]);
    const c = new DocumentController(board([]), { onCommit: (d) => (committed = d), normalize });
    c.update((d) => {
      d.elements.push(shape('x', 0, 0));
    });
    expect(committed?.settings.nextAnnotationNumber).toBe(7);
    expect(committed?.kind).toBe('flowchart');
    expect(c.latest).toBe(committed);
  });
});
