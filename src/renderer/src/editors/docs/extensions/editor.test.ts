/** Behaviour tests with a real TipTap editor in jsdom: keymap audit and Whimsical input rules. */

import { Editor, getExtensionField } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocExtensions } from './index';
import { markdownToDoc } from '../markdown/parse';
import { docToMarkdown } from '../markdown/serialize';
import { selectMoreTransaction } from './selectMore';
import { TextSelection } from '@tiptap/pm/state';
import type { DocNode } from '../markdown/constants';

let editor: Editor | null = null;

function make(md = ''): Editor {
  editor = new Editor({ extensions: createDocExtensions(), content: markdownToDoc(md) as never });
  return editor;
}

function type(e: Editor, text: string): void {
  for (const ch of text) {
    const { from, to } = e.state.selection;
    const handled = e.view.someProp('handleTextInput', (f) => f(e.view, from, to, ch, () => e.state.tr.insertText(ch, from, to)));
    if (!handled) e.view.dispatch(e.state.tr.insertText(ch, from, to));
  }
}

const markdown = (e: Editor): string => docToMarkdown(e.getJSON() as DocNode);

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('keymap audit', () => {
  it('no extension binds a key that belongs to the app or to Whimsical commands', () => {
    const e = make();
    const bindings = new Map<string, string[]>();
    for (const ext of e.extensionManager.extensions) {
      const fn = getExtensionField<() => Record<string, unknown>>(ext, 'addKeyboardShortcuts', {
        name: ext.name,
        options: ext.options,
        storage: ext.storage,
        editor: e,
        type: e.schema.nodes[ext.name] ?? e.schema.marks[ext.name],
      } as never);
      if (!fn) continue;
      for (const key of Object.keys(fn.call({ name: ext.name, options: ext.options, storage: ext.storage, editor: e, type: null }))) {
        bindings.set(key, [...(bindings.get(key) ?? []), ext.name]);
      }
    }
    const forbidden = ['Mod-e', 'Mod-E', 'Mod-Shift-b', 'Mod-Alt-c', 'Mod-Alt-0', 'Mod-Shift-s', 'Mod-Alt-1', 'Mod-Alt-2', 'Mod-Alt-3', 'Mod-Shift-9'];
    for (const key of forbidden) expect(bindings.get(key), key).toBeUndefined();
    // Mod-Enter belongs to the docs keymap only (open nested file / insert table row).
    expect(bindings.get('Mod-Enter')).toContain('docsKeymap');
    expect(bindings.get('Shift-Enter')).toEqual(['docsKeymap']);
    for (const key of ['Mod-b', 'Mod-i', 'Mod-Shift-h', 'Mod-Shift-x', 'Mod-Shift-k', 'Mod-Shift-u', 'Alt-k', 'Mod-\\', 'Mod-Shift-8', 'Mod-Shift-7']) {
      expect(bindings.has(key) || bindings.has(key.replace('Mod-b', 'Mod-B').replace('Mod-i', 'Mod-I')), key).toBe(true);
    }
  });
});

describe('Whimsical input rules', () => {
  it('*text* makes bold (not italic)', () => {
    const e = make();
    type(e, 'say *hello*');
    expect(markdown(e)).toBe('say **hello**\n');
  });

  it('_text_ makes italic', () => {
    const e = make();
    type(e, 'an _idea_');
    expect(markdown(e)).toBe('an _idea_\n');
  });

  it('~text~ makes strikethrough', () => {
    const e = make();
    type(e, '~gone~');
    expect(markdown(e)).toBe('~~gone~~\n');
  });

  it('`text` makes inline code', () => {
    const e = make();
    type(e, 'run `ls`');
    expect(markdown(e)).toBe('run `ls`\n');
  });

  it('"_ " starts a checklist', () => {
    const e = make();
    type(e, '_ ');
    type(e, 'buy milk');
    expect(markdown(e)).toBe('- [ ] buy milk\n');
  });

  it('"# " ... "### " make headings, "- " a bullet list, "1. " a numbered list, "> " a quote', () => {
    for (const [trigger, expected] of [
      ['# ', '# x\n'],
      ['## ', '## x\n'],
      ['### ', '### x\n'],
      ['- ', '- x\n'],
      ['* ', '- x\n'],
      ['1. ', '1. x\n'],
      ['> ', '> x\n'],
    ] as const) {
      const e = make();
      type(e, `${trigger}x`);
      expect(markdown(e), trigger).toBe(expected);
      e.destroy();
    }
  });

  it('--- is a line divider and *** a section divider', () => {
    let e = make();
    type(e, '---');
    expect(markdown(e)).toBe('---\n');
    e.destroy();
    e = make();
    type(e, '***');
    expect(markdown(e)).toBe('***\n');
  });

  it('```  makes a code block', () => {
    const e = make();
    type(e, '```');
    type(e, ' ');
    expect(e.isActive('codeBlock')).toBe(true);
  });

  it(':bulb: becomes the emoji character', () => {
    const e = make();
    type(e, 'idea :bulb:');
    expect(markdown(e)).toBe('idea 💡\n');
  });

  it('typing an opening quote over a selection wraps it', () => {
    const e = make('hello world\n');
    e.commands.setTextSelection({ from: 1, to: 6 });
    type(e, '(');
    expect(markdown(e)).toBe('(hello) world\n');
  });
});

describe('commands', () => {
  it('toggleCode via the command and the callout wrapper work', () => {
    const e = make('text\n');
    e.commands.selectAll();
    e.commands.setCallout({ color: 'green', icon: 'thumbs-up' });
    expect(markdown(e)).toBe('> [!callout color=green icon=thumbs-up]\n> text\n');
  });

  it('inserts a table that serialises as GFM', () => {
    const e = make();
    e.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    expect(markdown(e)).toBe('|  |  |\n| --- | --- |\n|  |  |\n');
  });
});

describe('progressive select all', () => {
  it('selects the block text, then the enclosing block, then the document', () => {
    const e = make('- one\n- two\n\nafter\n');
    e.commands.setTextSelection(3);
    const step = (): void => {
      const tr = selectMoreTransaction(e.state);
      if (tr) e.view.dispatch(tr);
    };
    step();
    expect(e.state.doc.textBetween(e.state.selection.from, e.state.selection.to)).toBe('one');
    step();
    expect(e.state.doc.textBetween(e.state.selection.from, e.state.selection.to, '|')).toBe('one|two');
    step();
    expect(e.state.selection.from).toBe(0);
    expect(e.state.selection.to).toBe(e.state.doc.content.size);
    expect(selectMoreTransaction(e.state)).toBeNull();
    expect(e.state.selection instanceof TextSelection).toBe(false);
  });
});

// jsdom reports a non-mac platform, so ProseMirror maps Mod to Ctrl here (Cmd on macOS).
describe('keyboard dispatch', () => {
  function press(e: Editor, init: KeyboardEventInit): boolean {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    return Boolean(e.view.someProp('handleKeyDown', (f) => f(e.view, event)));
  }

  it('Cmd+A selects progressively instead of the whole document', () => {
    const e = make('one\n\ntwo\n');
    e.commands.setTextSelection(2);
    expect(press(e, { key: 'a', ctrlKey: true })).toBe(true);
    expect(e.state.doc.textBetween(e.state.selection.from, e.state.selection.to)).toBe('one');
  });

  it('Cmd+Shift+X toggles strikethrough, Cmd+Shift+K inline code, Cmd+\\ paragraph', () => {
    const e = make('text\n');
    e.commands.selectAll();
    press(e, { key: 'x', ctrlKey: true, shiftKey: true });
    expect(markdown(e)).toBe('~~text~~\n');
    press(e, { key: 'x', ctrlKey: true, shiftKey: true });
    press(e, { key: 'k', ctrlKey: true, shiftKey: true });
    expect(markdown(e)).toBe('`text`\n');
    e.commands.setHeading({ level: 2 });
    press(e, { key: '\\', ctrlKey: true });
    expect(e.isActive('paragraph')).toBe(true);
  });

  it('Cmd+E is not handled by the editor (app: toggle sidebar)', () => {
    const e = make('text\n');
    e.commands.selectAll();
    expect(press(e, { key: 'e', ctrlKey: true })).toBe(false);
  });
});
