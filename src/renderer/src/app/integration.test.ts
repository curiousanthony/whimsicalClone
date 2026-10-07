/**
 * Cross-module integration checks (integrator): every file kind opens with its editor, every
 * format survives the real autosave path unchanged and stably, and the merged shortcut tables
 * have no ambiguous bindings, including the native (TipTap / ProseMirror) rows.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCombo, parseCombo } from '@shared/keys';
import { FILE_KINDS } from '@shared/fileKinds';
import type { DesktopApi } from '@shared/ipc';
import type { BoardDocument, BoardElement, RichText, ShortcutDef } from '@renderer/core/types';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import { i18n } from '@renderer/i18n';
import { markdownToDoc } from '@renderer/editors/docs/markdown/parse';
import { docToMarkdown } from '@renderer/editors/docs/markdown/serialize';
import { changeDocument, ensureDocument, flushDocuments, resetDocuments, useDocuments } from '@renderer/shell/state/documents';
import { allShortcutDefs, editorRegistry } from './editors';

/* ------------------------------------------------------------------------------------------
 * Registry
 * ---------------------------------------------------------------------------------------- */

describe('editor registry wiring', () => {
  it('has a labelled editor component for every file kind the sidebar lists', () => {
    for (const info of FILE_KINDS) {
      const editor = editorRegistry.forPath(`Folder/Sub folder/My file${info.extension}`);
      expect(editor?.kind, info.kind).toBe(info.kind);
      expect(editor?.component, info.kind).toBeDefined();
      expect(i18n.exists(editor!.labelKey), editor!.labelKey).toBe(true);
      expect(i18n.exists(editor!.newFileNameKey), editor!.newFileNameKey).toBe(true);
      expect(i18n.exists(`common:${info.labelKey}`), info.labelKey).toBe(true);
    }
  });

  it('matches extensions case-insensitively and ignores other files', () => {
    expect(editorRegistry.forPath('A/Plan.WFLOW')?.kind).toBe('flowchart');
    expect(editorRegistry.forPath('A/README.MD')?.kind).toBe('doc');
    expect(editorRegistry.forPath('A/photo.png')).toBeUndefined();
    expect(editorRegistry.forPath('A/archive')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------------------------------
 * Autosave round trips
 * ---------------------------------------------------------------------------------------- */

const rich = (text: string): RichText => ({
  blocks: [
    { type: 'p', spans: [{ text, marks: ['bold'] }, { text: ' [1, 2] "quoted" \\ é 🙂', href: 'https://example.com' }] },
    { type: 'check', checked: true, indent: 1, spans: [{ text: 'done' }] },
  ],
});

function sampleElements(): BoardElement[] {
  return [
    { id: 'a', type: 'shape', kind: 'diamond', x: -120.5, y: 40, w: 160, h: 80, color: 'blue', fillStyle: 'fill', text: rich('Decide'), textSize: 'm', textAlign: 'center', verticalAlign: 'middle', autoHeight: true, icon: { name: 'Star', placement: 'top' } },
    { id: 'b', type: 'sticky', x: 300, y: 0, w: 200, h: 200, color: 'yellow', text: rich('Idea'), textSize: 'l', textAlign: 'left', autoSize: true },
    { id: 'c', type: 'connector', start: { kind: 'attached', elementId: 'a', side: 'right' }, end: { kind: 'free', x: 290, y: 100 }, route: 'elbow', waypoints: [{ x: 1, y: 2 }], color: 'gray', dashed: true, startEndpoint: 'none', endEndpoint: 'arrow', label: { text: rich('yes'), t: 0.5, background: true } },
    { id: 'd', type: 'stroke', x: 0, y: 300, w: 50, h: 20, tool: 'marker', size: 'thin', color: '#ff0000', points: [0, 0, 0.5, 10.25, -3, 1, 50, 20, 0.75], isPen: true },
    { id: 'e', type: 'wire', x: 600, y: 0, w: 120, h: 40, component: 'button', size: 'M', state: 'default', text: rich('Press me'), textSize: 's', props: { items: ['One', 'Two'], nested: { on: true, n: null } } },
    { id: 'f', type: 'frame', x: 560, y: -60, w: 390, h: 844, device: 'iphone-14', name: 'Home', statusBar: true, keyboard: false, orientation: 'portrait' },
    { id: 'g', type: 'mindmapNode', x: 0, y: 600, w: 120, h: 40, rootId: 'g', treeParentId: null, order: 0, text: rich('Root'), textSize: 'l', map: { orientation: 'horizontal', lineStyle: 'curved' } },
    { id: 'h', type: 'mindmapNode', x: 200, y: 600, w: 100, h: 30, rootId: 'g', treeParentId: 'g', order: 0, side: 'right', text: rich('Child'), textSize: 'm', collapsed: false },
    { id: 'i', type: 'table', x: 0, y: 900, w: 240, h: 80, columns: [{ id: 'c1', width: 120 }, { id: 'c2', width: 120 }], rows: [{ id: 'r1' }], cells: { 'r1:c1': { text: rich('cell') } }, headerRow: true, tableStyle: 'striped', textSize: 's' },
  ] as BoardElement[];
}

const DOC_SAMPLE = [
  '# Project notes',
  '',
  'Some **bold**, _italic_, ~~gone~~, `code` and ==highlight== with a [link](https://example.com) and [Roadmap](wc://file/Product/Roadmap.wboard).',
  '',
  '## Tasks',
  '',
  '- [ ] open item',
  '- [x] closed item',
  '',
  '1. first',
  '2. second',
  '   - nested bullet',
  '',
  '| Name | Value |',
  '| --- | ---: |',
  '| a | 1 |',
  '',
  '```ts',
  'const x = 1;',
  '```',
  '',
  '> [!callout color=green icon=info]',
  '> Callout body',
  '',
  '> quote',
  '>> deeper',
  '',
  '---',
  '',
  '***',
  '',
  '::embed[https://www.youtube.com/watch?v=abc]{height=525 fit=text}',
  '',
  '::board[Product/Roadmap.wboard]{height=525}',
  '',
  '![diagram](wsasset://0123456789abcdef.png)',
  '',
].join('\n');

function fakeDisk(path: string, initial: string) {
  const disk = { content: initial, hash: 'h0', n: 0 };
  const api = {
    fs: {
      readFile: vi.fn(async () => ({ ok: true, value: { content: disk.content, stat: { path, mtimeMs: 0, size: 0, hash: disk.hash } } })),
      writeFile: vi.fn(async (_p: string, content: string) => {
        disk.n += 1;
        disk.content = content;
        disk.hash = `h${disk.n}`;
        return { ok: true, value: { path, mtimeMs: 0, size: content.length, hash: disk.hash } };
      }),
    },
    viewState: { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) },
  };
  (window as unknown as { api: Partial<DesktopApi> }).api = api as unknown as DesktopApi;
  return disk;
}

describe('autosave round trip per format', () => {
  beforeEach(() => resetDocuments());
  afterEach(() => resetDocuments());

  for (const editor of editorRegistry.all) {
    it(`${editor.kind}: load -> edit -> save -> reload gives the same content, stably serialized`, async () => {
      const path = `Folder/Sample${editor.extensions[0]}`;
      const isDoc = editor.kind === 'doc';
      const disk = fakeDisk(path, isDoc ? '' : editor.serialize(editor.createEmpty()));
      await ensureDocument(path);
      expect(useDocuments.getState().docs[path]?.status).toBe('ready');

      const edited: unknown = isDoc
        ? DOC_SAMPLE
        : ({ ...createEmptyBoard(editor.kind as BoardDocument['kind']), elements: sampleElements(), extra: { futureField: { keep: [1, 2] } } } satisfies BoardDocument);
      changeDocument(path, edited);
      await flushDocuments();
      expect(disk.n).toBe(1);

      const written = disk.content;
      const reparsed = editor.parse(written, path);
      expect(reparsed).toEqual(edited);
      // Saving the reloaded content again must not churn the file.
      expect(editor.serialize(reparsed)).toBe(written);
      expect(written.endsWith('\n')).toBe(true);
    });
  }

  it('docs: Markdown -> TipTap JSON -> Markdown is a fixed point after one pass', () => {
    const once = docToMarkdown(markdownToDoc(DOC_SAMPLE));
    expect(docToMarkdown(markdownToDoc(once))).toBe(once);
    for (const fragment of ['wc://file/Product/Roadmap.wboard', '::board[Product/Roadmap.wboard]', '[!callout color=green icon=info]', '- [x] closed item', '==highlight==', 'wsasset://0123456789abcdef.png']) {
      expect(once).toContain(fragment);
    }
  });
});

/* ------------------------------------------------------------------------------------------
 * Shortcut collisions
 * ---------------------------------------------------------------------------------------- */

/**
 * Pairs that share a combo in one scope on purpose: the handler that runs depends on context
 * (ProseMirror keymaps return false outside their context, registry handlers use isEnabled).
 */
const INTENDED_SHARED: readonly (readonly [string, string])[] = [
  ['docs.inlineCode', 'docs.codeLanguage'], // ⇧⌘K: inline code, or language picker inside a code block
  ['docs.openNested', 'docs.tableInsertRow'], // ⌘↩: open nested file, or insert row inside a table
  ['canvasText.lineBreak', 'mindmap.editLineBreak'], // ⇧↩ while editing text (mind-map nodes reuse it)
  ['canvasText.stopEditing', 'mindmap.editStop'], // Esc while editing text
];

function isIntended(a: string, b: string): boolean {
  return INTENDED_SHARED.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function combosOf(def: ShortcutDef): string[] {
  return def.keys.map((k) => formatCombo(parseCombo(k)));
}

describe('shortcut bindings', () => {
  it('never bind the same combo twice in one scope, native rows included', () => {
    const byScopeCombo = new Map<string, string[]>();
    for (const def of allShortcutDefs) {
      for (const combo of combosOf(def)) {
        const key = `${def.scope} ${combo}`;
        byScopeCombo.set(key, [...(byScopeCombo.get(key) ?? []), def.id]);
      }
    }
    const clashes: string[] = [];
    for (const [key, ids] of byScopeCombo) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          if (!isIntended(ids[i]!, ids[j]!)) clashes.push(`${key}: ${ids[i]} vs ${ids[j]}`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('keeps the allowlist honest (every intended pair really shares a combo and scope)', () => {
    const byId = new Map(allShortcutDefs.map((d) => [d.id, d]));
    for (const [a, b] of INTENDED_SHARED) {
      const da = byId.get(a);
      const db = byId.get(b);
      expect(da && db, `${a} / ${b}`).toBeTruthy();
      expect(da!.scope).toBe(db!.scope);
      expect(combosOf(da!).some((c) => combosOf(db!).includes(c)), `${a} / ${b}`).toBe(true);
    }
  });

  it('only shadows app-wide commands where the SPEC says so', () => {
    // App-scope rows fire everywhere; an inner scope reusing the combo hides them there.
    const appCombos = new Map<string, string>();
    for (const def of allShortcutDefs) if (def.scope === 'app') for (const c of combosOf(def)) appCombos.set(c, def.id);
    const shadows = allShortcutDefs
      .filter((d) => d.scope !== 'app')
      .flatMap((d) => combosOf(d).filter((c) => appCombos.has(c)).map((c) => `${c}: ${d.id} over ${appCombos.get(c)}`))
      .sort();
    expect(shadows).toMatchSnapshot();
  });
});
