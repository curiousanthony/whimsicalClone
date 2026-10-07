/**
 * Autosave, history and external-change behaviour of open documents (SPEC 7 and 8) against
 * a fake window.api.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopApi, IpcResult } from '@shared/ipc';
import {
  AUTOSAVE_DELAY_MS,
  changeDocument,
  ensureDocument,
  flushDocuments,
  handleFsEvents,
  rebaseDocuments,
  redoDocument,
  resetDocuments,
  undoDocument,
  useDocuments,
} from './state/documents';

const PATH = 'Notes.md';

function makeApi(initial: string) {
  const disk = { content: initial, hash: 'h0', version: 0 };
  const writes: { content: string; expectedHash?: string | undefined }[] = [];
  const api = {
    fs: {
      readFile: vi.fn(
        async (): Promise<
          IpcResult<{ content: string; stat: { path: string; mtimeMs: number; size: number; hash: string } }>
        > => ({
          ok: true,
          value: {
            content: disk.content,
            stat: { path: PATH, mtimeMs: 0, size: disk.content.length, hash: disk.hash },
          },
        }),
      ),
      writeFile: vi.fn(async (_path: string, content: string, options?: { expectedHash?: string }) => {
        writes.push({ content, expectedHash: options?.expectedHash });
        if (options?.expectedHash && options.expectedHash !== disk.hash) {
          return { ok: false as const, code: 'CONFLICT' as const, message: 'changed' };
        }
        disk.version += 1;
        disk.content = content;
        disk.hash = `h${disk.version}`;
        return { ok: true as const, value: { path: PATH, mtimeMs: 0, size: content.length, hash: disk.hash } };
      }),
    },
    viewState: { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) },
  };
  (window as unknown as { api: Partial<DesktopApi> }).api = api as unknown as DesktopApi;
  return { api, disk, writes };
}

function doc() {
  return useDocuments.getState().docs[PATH]!;
}

describe('documents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDocuments();
  });
  afterEach(() => {
    resetDocuments();
    vi.useRealTimers();
  });

  it('loads, autosaves after the debounce with expectedHash, and clears dirty', async () => {
    const { writes } = makeApi('hello\n');
    await ensureDocument(PATH);
    expect(doc()).toMatchObject({ status: 'ready', content: 'hello\n', hash: 'h0', dirty: false });

    changeDocument(PATH, 'hello world\n');
    changeDocument(PATH, 'hello world!\n');
    expect(doc().dirty).toBe(true);
    expect(writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 10);
    expect(writes).toEqual([{ content: 'hello world!\n', expectedHash: 'h0' }]);
    expect(doc()).toMatchObject({ dirty: false, hash: 'h1' });
  });

  it('flushes pending saves immediately (before quit / rename)', async () => {
    const { writes } = makeApi('a\n');
    await ensureDocument(PATH);
    changeDocument(PATH, 'b\n');
    await flushDocuments();
    expect(writes).toHaveLength(1);
    expect(doc().dirty).toBe(false);
  });

  it('local edits win on conflict: overwrite after a CONFLICT', async () => {
    const { writes, disk } = makeApi('a\n');
    await ensureDocument(PATH);
    disk.hash = 'external';
    changeDocument(PATH, 'mine\n');
    await flushDocuments();
    expect(writes.map((w) => w.expectedHash)).toEqual(['h0', undefined]);
    expect(disk.content).toBe('mine\n');
  });

  it('reloads a clean document changed on disk, keeps a dirty one', async () => {
    const { disk, writes } = makeApi('a\n');
    await ensureDocument(PATH);
    disk.content = 'from finder\n';
    disk.hash = 'ext1';
    handleFsEvents([{ type: 'change', path: PATH, hash: 'ext1' }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(doc()).toMatchObject({ content: 'from finder\n', hash: 'ext1', dirty: false, revision: 1 });

    changeDocument(PATH, 'local\n');
    disk.hash = 'ext2';
    handleFsEvents([{ type: 'change', path: PATH, hash: 'ext2' }]);
    expect(doc()).toMatchObject({ content: 'local\n', hash: 'ext2', dirty: true });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 10);
    expect(writes[writes.length - 1]).toEqual({ content: 'local\n', expectedHash: 'ext2' });
  });

  it('ignores echoes of its own writes and marks deletions', async () => {
    const { api } = makeApi('a\n');
    await ensureDocument(PATH);
    handleFsEvents([{ type: 'change', path: PATH, hash: 'h0' }]);
    expect(api.fs.readFile).toHaveBeenCalledTimes(1);
    handleFsEvents([{ type: 'unlink', path: PATH }]);
    expect(doc().deletedOnDisk).toBe(true);
  });

  it('re-keys documents on rename', async () => {
    makeApi('a\n');
    await ensureDocument(PATH);
    rebaseDocuments(PATH, 'Renamed.md');
    expect(useDocuments.getState().docs['Renamed.md']?.path).toBe('Renamed.md');
    expect(useDocuments.getState().docs[PATH]).toBeUndefined();
  });

  it('host history undo / redo for canvas documents', async () => {
    makeApi('');
    const board = 'Board.wboard';
    (window.api.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify({
          format: 'whimsical-clone/board',
          version: 1,
          kind: 'board',
          settings: { mode: 'diagram' },
          elements: [],
        }),
        stat: { path: board, mtimeMs: 0, size: 1, hash: 'b0' },
      },
    });
    await ensureDocument(board);
    const first = useDocuments.getState().docs[board]!.content as { elements: unknown[] };
    const second = { ...first, elements: [{ id: 'x' }] };
    changeDocument(board, second, { selection: ['x'] });
    expect(undoDocument(board)).toBe(true);
    expect(useDocuments.getState().docs[board]!.content).toBe(first);
    expect(useDocuments.getState().docs[board]!.lastHistoryAction).toMatchObject({ kind: 'undo', selection: ['x'] });
    expect(redoDocument(board)).toBe(true);
    expect(useDocuments.getState().docs[board]!.content).toBe(second);
  });
});
