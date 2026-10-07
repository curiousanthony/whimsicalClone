/**
 * Round-trip through the real TipTap schema: ProseMirror silently drops attributes the schema does
 * not declare and rejects invalid shapes, so the converter test alone does not prove fidelity.
 */

import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createDocExtensions } from './index';
import { markdownToDoc } from '../markdown/parse';
import { docToMarkdown } from '../markdown/serialize';
import type { DocNode } from '../markdown/constants';

const schema = getSchema(createDocExtensions());

function throughSchema(md: string): { md: string; doc: DocNode } {
  const json = markdownToDoc(md);
  const node = schema.nodeFromJSON(json);
  node.check();
  const back = node.toJSON() as DocNode;
  return { md: docToMarkdown(back), doc: back };
}

const FIXTURES: Record<string, string> = {
  paragraph: 'Hello world\n',
  headings: '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6\n',
  marks: '**bold** _italic_ ~~strike~~ `code` ==highlight==\n',
  'link with title': 'A [link](https://example.com "Title") here\n',
  'file link': 'Go to [Roadmap](wc://file/Product/Roadmap.wboard)\n',
  'inline image': 'Before ![alt](wsasset://abc.png "t") after\n',
  'block image': '![alt text](wsasset://abcdef0123456789.png)\n',
  'bullet list': '- one\n- two\n',
  'ordered list': '3. three\n4. four\n',
  'nested lists': '- one\n  - nested\n    - deeper\n- two\n',
  'mixed lists': '1. one\n   - sub bullet\n2. two\n',
  'task list': '- [ ] todo\n- [x] done\n',
  'nested task list': '- [ ] parent\n  - [x] child\n',
  blockquote: '> quote\n',
  'nested quote': '> level 1\n>\n> > level 2\n',
  'code block': '```ts\nconst a = 1;\n```\n',
  'code without language': '```\nplain\n```\n',
  'line divider': 'above\n\n---\n\nbelow\n',
  'section divider': 'above\n\n***\n\nbelow\n',
  table: '| a | b |\n| --- | --- |\n| 1 | 2 |\n',
  'table alignment': '| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n',
  'table marks': '| **a** | `b` |\n| --- | --- |\n| ==x== | [l](https://e.com) |\n',
  callout: '> [!callout color=red icon=flag]\n> First\n>\n> Second\n',
  'callout with list': '> [!callout color=green icon=thumbs-up]\n>\n> - a\n> - b\n',
  details: '<details>\n<summary>Title</summary>\n\nHidden\n\n</details>\n',
  'details highlight': '<details>\n<summary>A ==b== c</summary>\n\nBody ==x==\n\n</details>\n',
  embed: '::embed[https://www.youtube.com/watch?v=abc]{height=300 fit=page}\n',
  'board embed': '::board[Product/Roadmap.wboard]{height=525}\n',
  'front matter': '---\ntitle: Hello\n---\n\n# Heading\n',
  'html block': '<div class="x">raw</div>\n',
  'link definition': '[1]: https://example.com\n',
  'hard break': 'line one\\\nline two\n',
};

describe('markdown -> TipTap schema -> markdown', () => {
  for (const [name, md] of Object.entries(FIXTURES)) {
    it(name, () => {
      expect(throughSchema(md).md).toBe(md);
    });
  }

  it('keeps callout colour and icon attributes', () => {
    const { doc } = throughSchema('> [!callout color=purple icon=star]\n> x\n');
    expect(doc.content?.[0]?.attrs).toMatchObject({ color: 'purple', icon: 'star' });
  });

  it('keeps the divider variant', () => {
    const { doc } = throughSchema('***\n');
    expect(doc.content?.[0]?.attrs).toMatchObject({ variant: 'section' });
  });

  it('exposes the nodes the slash menu relies on', () => {
    for (const name of ['callout', 'details', 'table', 'codeBlock', 'taskList', 'embed', 'boardEmbed', 'rawMarkdown', 'horizontalRule', 'blockquote']) {
      expect(schema.nodes[name], name).toBeDefined();
    }
  });
});
