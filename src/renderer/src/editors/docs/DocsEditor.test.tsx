/**
 * Mounted DocsEditor (jsdom): the file is never rewritten on open, edits emit Markdown, external
 * reloads do not echo back, and the docs shortcut handlers are bound while active.
 */

import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShortcutRegistry } from '@renderer/core/shortcuts';
import type { EditorServices, ScopeId, ShortcutHandler } from '@renderer/core/types';
import { allShortcutDefs } from '@renderer/app/editors';
import { DocsEditor } from './DocsEditor';
import { headingSlug, nestedFolderOf, parentDocOf } from './logic/nested';

afterEach(cleanup);

function setup(initial: string) {
  const registry = new ShortcutRegistry('mac');
  registry.define(allShortcutDefs);
  const changes: string[] = [];
  let scopes: readonly ScopeId[] = [];
  const prefsSet = vi.fn(() => Promise.resolve({}));
  const services = {
    api: {
      prefs: { get: () => Promise.resolve({ docTextSize: 'large', docTextWidth: 'narrow' }), set: prefsSet, onChange: () => () => undefined },
      fs: { listTree: () => Promise.resolve({ ok: false }), onEvents: () => () => undefined, stat: () => Promise.resolve({ ok: false }) },
      app: { openExternal: vi.fn() },
    },
    openFile: vi.fn(),
    getViewState: () => undefined,
    setViewState: vi.fn(),
    notify: vi.fn(),
  } as unknown as EditorServices;
  const ui = (content: string) => (
    <DocsEditor
      filePath="Notes/Meeting.md"
      title="Meeting"
      content={content}
      onChange={(next) => {
        changes.push(next);
        utils.rerender(ui(next));
      }}
      registerShortcuts={(handlers: readonly ShortcutHandler[]) => registry.bind(handlers)}
      setScopes={(s) => {
        scopes = s;
        registry.setActiveScopes(s);
      }}
      isActive
      services={services}
    />
  );
  const utils = render(ui(initial));
  const dom = utils.container.querySelector('.docs-content') as HTMLElement & { editor?: Editor };
  return { utils, ui, registry, changes, services, prefsSet, scopes: () => scopes, editor: () => dom.editor! };
}

describe('DocsEditor', () => {
  it('never writes a file just because it was opened or clicked', async () => {
    // Non-canonical Markdown (`*` bullets, `__bold__`) must not be normalised on open.
    const t = setup('# Title\n\n* one\n* two\n\n__bold__ text\n');
    await waitFor(() => expect(t.editor()).toBeDefined());
    act(() => {
      t.editor().commands.focus('end');
      t.editor().commands.setTextSelection(3);
    });
    expect(t.changes).toEqual([]);
    expect(t.utils.container.querySelector('.docs-title')).toHaveTextContent('Meeting');
  });

  it('emits Markdown for real edits and declares the docs scope', async () => {
    const t = setup('Hello\n');
    await waitFor(() => expect(t.editor()).toBeDefined());
    act(() => {
      t.editor().chain().focus('end').insertContent(' world').run();
    });
    expect(t.changes.at(-1)).toBe('Hello world\n');
    expect(t.scopes()).toEqual(['docs']);
  });

  it('replaces content reloaded from disk without echoing it back', async () => {
    const t = setup('Old text\n');
    await waitFor(() => expect(t.editor()).toBeDefined());
    act(() => t.utils.rerender(t.ui('## New heading\n\nFrom disk\n')));
    expect(t.editor().getText()).toContain('From disk');
    expect(t.changes).toEqual([]);
    // The reload is not an undo step.
    act(() => {
      t.registry.run('edit.undo', { source: 'menu' });
    });
    expect(t.editor().getText()).toContain('From disk');
  });

  it('routes the Edit menu undo to TipTap and binds the docs commands', async () => {
    const t = setup('A\n');
    await waitFor(() => expect(t.editor()).toBeDefined());
    act(() => {
      t.editor().chain().focus('end').insertContent('B').run();
    });
    expect(t.changes.at(-1)).toBe('AB\n');
    act(() => {
      t.registry.run('edit.undo', { source: 'menu' });
    });
    expect(t.changes.at(-1)).toBe('A\n');
    for (const id of ['docs.copyAsMarkdown', 'docs.copyBlockLink', 'docs.textSizeUp', 'docs.textSizeDown', 'docs.goToParent', 'docs.focusMode']) {
      expect(t.registry.isBound(id), id).toBe(true);
    }
    act(() => {
      t.registry.run('docs.textSizeDown', { source: 'menu' });
    });
    expect(t.prefsSet).toHaveBeenCalledWith({ docTextSize: 'medium' });
  });
});

describe('nested file paths', () => {
  it('maps a doc to its nested folder and back', () => {
    expect(nestedFolderOf('Product/Roadmap.md')).toEqual({ dir: 'Product', name: 'Roadmap', path: 'Product/Roadmap' });
    expect(nestedFolderOf('Top.md')).toEqual({ dir: '', name: 'Top', path: 'Top' });
    expect(parentDocOf('Product/Roadmap/Child.wboard')).toBe('Product/Roadmap.md');
    expect(parentDocOf('Root.md')).toBeNull();
    expect(headingSlug('Café & Plans 2026!')).toBe('cafe-plans-2026');
  });
});
