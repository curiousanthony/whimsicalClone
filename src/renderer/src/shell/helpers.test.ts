import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@shared/ipc';
import { allShortcutDefs } from '@renderer/app/editors';
import { formatGesture } from '@renderer/core/shortcuts';
import type { ShortcutDef } from '@renderer/core/types';
import { translateKey } from '@renderer/i18n';
import { buildHelpGroups, scopesForContext } from './helpSheet';
import { extractText, findMatches } from './searchText';
import {
  canMoveInto,
  containingFolder,
  displayName,
  fileLink,
  findNode,
  parseFileLink,
  rebasePath,
  visibleRows,
} from './tree';
import { mountedTabIds } from './editorHost/EditorHost';
import type { Tab } from './state/tabs';

describe('help sheet', () => {
  const options = {
    translate: (k: string) => translateKey(k),
    formatGesture: (g: string) => formatGesture(g),
    scopes: null,
  };

  it('merges direction families into one ↑↓←→ row', () => {
    const defs: ShortcutDef[] = ['Up', 'Down', 'Left', 'Right'].map((d) => ({
      id: `canvas.quickAdd${d}`,
      keys: [`Alt+Arrow${d}`],
      scope: 'canvas',
      labelKey: `canvas:commands.quickAdd${d}`,
      group: 'quickAdd',
      // Tables hide the Down/Left/Right aliases; the family must still merge.
      hidden: d !== 'Up',
    }));
    const groups = buildHelpGroups(defs, options);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows).toHaveLength(1);
    expect(groups[0]?.rows[0]?.keys).toEqual(['⌥↑↓←→']);
  });

  it('keeps two-direction pairs as separate rows', () => {
    const defs: ShortcutDef[] = ['Up', 'Down'].map((d) => ({
      id: `mindmap.move${d}`,
      keys: [`Mod+Arrow${d}`],
      scope: 'canvas.mindmap',
      labelKey: 'x',
      group: 'mindmap',
    }));
    expect(buildHelpGroups(defs, options)[0]?.rows).toHaveLength(2);
  });

  it('filters by context scope, hides hidden rows and searches labels', () => {
    const docs = buildHelpGroups(allShortcutDefs, { ...options, scopes: scopesForContext('docs') });
    const scopes = new Set(docs.flatMap((g) => g.rows.map((r) => r.scope)));
    expect([...scopes].every((s) => s === 'app' || s === 'docs')).toBe(true);
    const all = buildHelpGroups(allShortcutDefs, options).flatMap((g) => g.rows.map((r) => r.id));
    expect(all).not.toContain('tab.select2');
    const searched = buildHelpGroups(allShortcutDefs, { ...options, query: 'command menu' }).flatMap((g) =>
      g.rows.map((r) => r.id),
    );
    expect(searched).toContain('app.commandMenu');
  });
});

describe('search text', () => {
  it('extracts text from board elements and markdown', () => {
    const board = JSON.stringify({
      format: 'whimsical-clone/board',
      elements: [
        { id: 'a', type: 'shape', text: { blocks: [{ type: 'p', spans: [{ text: 'Start ' }, { text: 'here' }] }] } },
        { id: 'b', type: 'section', name: 'Onboarding' },
        { id: 'c', type: 'connector', label: { text: { blocks: [{ type: 'p', spans: [{ text: 'yes' }] }] } } },
      ],
    });
    expect(extractText('x.wflow', board)).toEqual([
      { text: 'Start here', elementId: 'a' },
      { text: 'Onboarding', elementId: 'b' },
      { text: 'yes', elementId: 'c' },
    ]);
    expect(extractText('n.md', '# Title\n\nBody text')).toEqual([{ text: '# Title' }, { text: 'Body text' }]);
    expect(extractText('broken.wboard', '{nope')).toEqual([]);
  });

  it('finds case-insensitive matches with snippets', () => {
    const [match] = findMatches([{ text: 'The quick brown Fox jumps', elementId: 'z' }], 'fox');
    expect(match).toMatchObject({ elementId: 'z', length: 3 });
    expect(match!.snippet.slice(match!.start, match!.start + 3)).toBe('Fox');
  });
});

const tree: TreeNode = {
  path: '',
  name: 'ws',
  type: 'folder',
  mtimeMs: 0,
  children: [
    {
      path: 'Product',
      name: 'Product',
      type: 'folder',
      mtimeMs: 0,
      children: [{ path: 'Product/Flow.wflow', name: 'Flow.wflow', type: 'file', kind: 'flowchart', mtimeMs: 0 }],
    },
    { path: 'Notes.md', name: 'Notes.md', type: 'file', kind: 'doc', mtimeMs: 0 },
    { path: 'photo.png', name: 'photo.png', type: 'file', kind: null, mtimeMs: 0 },
  ],
};

describe('tree helpers', () => {
  it('finds nodes, folders and display names', () => {
    expect(findNode(tree, 'Product/Flow.wflow')?.kind).toBe('flowchart');
    expect(findNode(tree, 'Missing')).toBeNull();
    expect(containingFolder(tree, 'Product/Flow.wflow')).toBe('Product');
    expect(containingFolder(tree, 'Product')).toBe('Product');
    expect(displayName('Product/Flow.wflow')).toBe('Flow');
  });

  it('lists visible rows by expansion and hides unsupported files', () => {
    expect(visibleRows(tree, new Set(), null).map((r) => r.node.path)).toEqual(['Product', 'Notes.md']);
    expect(visibleRows(tree, new Set(['Product']), null).map((r) => `${r.depth}:${r.node.path}`)).toEqual([
      '0:Product',
      '1:Product/Flow.wflow',
      '0:Notes.md',
    ]);
  });

  it('rebases paths and validates moves', () => {
    expect(rebasePath('Product/Flow.wflow', 'Product', 'Plans')).toBe('Plans/Flow.wflow');
    expect(rebasePath('Productivity.md', 'Product', 'Plans')).toBe('Productivity.md');
    expect(canMoveInto('Product', 'Product/Sub')).toBe(false);
    expect(canMoveInto('Notes.md', '')).toBe(false);
    expect(canMoveInto('Notes.md', 'Product')).toBe(true);
  });

  it('round-trips workspace file links', () => {
    const link = fileLink('Product/My flow #1.wflow');
    expect(link).toBe('wc://file/Product/My%20flow%20%231.wflow');
    expect(parseFileLink(link)).toBe('Product/My flow #1.wflow');
  });
});

describe('editor mounting', () => {
  it('keeps the active tab and the most recent file tabs mounted', () => {
    const tabs: Tab[] = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      kind: 'file',
      path: `f${i}.md`,
      pinned: false,
    }));
    const mru = tabs.map((t) => t.id);
    const mounted = mountedTabIds(tabs, 't9', mru, 8);
    expect(mounted.size).toBe(8);
    expect(mounted.has('t9')).toBe(true);
    expect(mounted.has('t8')).toBe(false);
  });
});
