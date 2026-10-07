import { describe, expect, it } from 'vitest';
import { markdownToDoc } from './parse';
import { docToMarkdown } from './serialize';

const rt = (md: string): string => docToMarkdown(markdownToDoc(md));

/** Canonical Markdown must survive md -> doc -> md byte for byte. */
const CANONICAL: Record<string, string> = {
  paragraph: 'Hello world\n',
  'two paragraphs': 'One\n\nTwo\n',
  headings: '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6\n',
  marks: '**bold** _italic_ ~~strike~~ `code` ==highlight==\n',
  'nested marks': '**_bold italic_** and **_other_**\n',
  link: 'A [link](https://example.com) here\n',
  'link with title': 'A [link](https://example.com "Title") here\n',
  'bare url': 'See https://example.com now\n',
  'file link': 'Go to [Roadmap](wc://file/Product/Roadmap.wboard)\n',
  image: '![alt text](wsasset://abcdef0123456789.png)\n',
  'inline image': 'Before ![alt](wsasset://abc.png) after\n',
  'bullet list': '- one\n- two\n- three\n',
  'ordered list': '1. one\n2. two\n3. three\n',
  'ordered start': '3. three\n4. four\n',
  'nested lists': '- one\n  - nested\n    - deeper\n- two\n',
  'mixed lists': '1. one\n   - sub bullet\n   - another\n2. two\n',
  'task list': '- [ ] todo\n- [x] done\n',
  'nested task list': '- [ ] parent\n  - [x] child\n',
  'list item with two paragraphs': '- first\n\n  second\n',
  'blockquote': '> quote\n',
  'nested quote': '> level 1\n>\n> > level 2\n',
  'quote with list': '> - a\n> - b\n',
  'code block': '```ts\nconst a = 1;\n```\n',
  'code block without language': '```\nplain\n```\n',
  'code with backticks': '````md\n```js\nx\n```\n````\n',
  'line divider': 'above\n\n---\n\nbelow\n',
  'section divider': 'above\n\n***\n\nbelow\n',
  table: '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n',
  'table alignment': '| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n',
  'table marks': '| **a** | `b` |\n| --- | --- |\n| ==x== | [l](https://e.com) |\n',
  callout: '> [!callout color=blue icon=info]\n> Heads up\n',
  'callout multi': '> [!callout color=red icon=flag]\n> First\n>\n> Second\n',
  details: '<details>\n<summary>Title</summary>\n\nHidden\n\n</details>\n',
  'details highlight': '<details>\n<summary>A ==b== c</summary>\n\nBody ==x==\n\n</details>\n',
  'nested details': '<details>\n<summary>Outer</summary>\n\n<details>\n<summary>Inner</summary>\n\ninner body\n\n</details>\n\n</details>\n',
  embed: '::embed[https://www.youtube.com/watch?v=abc]{height=525 fit=text}\n',
  'embed page': '::embed[https://example.com/x]{height=300 fit=page}\n',
  'board embed': '::board[Product/Roadmap.wboard]{height=525}\n',
  'front matter': '---\ntitle: Hello\ntags: [a, b]\n---\n\n# Heading\n',
  'escaped chars': 'Literal \\*stars\\* and \\_underscores\\_ and \\`ticks\\`\n',
  'hard break': 'line one\\\nline two\n',
  'html block': '<div class="x">raw</div>\n',
};

describe('markdown round trip: canonical documents are byte-stable', () => {
  for (const [name, md] of Object.entries(CANONICAL)) {
    it(name, () => {
      expect(rt(md)).toBe(md);
    });
  }
});

describe('markdown round trip: non-canonical input normalises and then is stable', () => {
  const cases: Array<[string, string, string]> = [
    ['star bold-italic styles', '*x* and __y__ and **z**', '_x_ and **y** and **z**\n'],
    ['star list', '* a\n* b\n', '- a\n- b\n'],
    ['plus list', '+ a\n+ b\n', '- a\n- b\n'],
    ['star task', '* [ ] a\n* [x] b\n', '- [ ] a\n- [x] b\n'],
    ['crlf', 'a\r\n\r\nb\r\n', 'a\n\nb\n'],
    ['setext heading', 'Title\n=====\n', '# Title\n'],
    ['indented code', '    code\n', '```\ncode\n```\n'],
    ['no trailing newline', 'abc', 'abc\n'],
    ['mark nesting order', '_**x**_', '**_x_**\n'],
    ['reference link keeps its definition', 'A [ref][1]\n\n[1]: https://example.com\n', 'A [ref](https://example.com)\n\n[1]: https://example.com\n'],
  ];
  for (const [name, input, expected] of cases) {
    it(name, () => {
      const once = rt(input);
      expect(once).toBe(expected);
      expect(rt(once)).toBe(once);
      expect(markdownToDoc(once)).toEqual(markdownToDoc(input));
    });
  }
});

describe('document level', () => {
  it('empty text yields one empty paragraph and serialises to empty', () => {
    expect(markdownToDoc('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(rt('')).toBe('');
  });

  it('highlight survives in details summaries and table cells', () => {
    const doc = JSON.stringify(markdownToDoc('<details>\n<summary>a ==b== c</summary>\n\nx\n\n</details>\n\n| a |\n| --- |\n| ==h== |\n'));
    expect(doc.match(/"highlight"/g)?.length).toBe(2);
  });

  it('keeps unmodelled blocks verbatim', () => {
    const doc = markdownToDoc('<div>x</div>\n');
    expect(doc.content?.[0]?.type).toBe('rawMarkdown');
  });

  it('is idempotent on a mixed document', () => {
    const md = [
      '# Title',
      '',
      'Paragraph with **bold**, _italic_ and a [link](https://a.b).',
      '',
      '- [ ] task',
      '- [x] done',
      '',
      '> [!callout color=green icon=thumbs-up]',
      '> Nice',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '```js',
      'x()',
      '```',
      '',
    ].join('\n');
    expect(rt(md)).toBe(md);
  });

  it('empty paragraph between blocks keeps a stable doc', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }, { type: 'paragraph' }, { type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] };
    const md = docToMarkdown(doc);
    const back = markdownToDoc(md);
    expect(docToMarkdown(back)).toBe(md);
    expect(back.content?.map((n) => n.type)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    // The spacer comes back as an empty paragraph, not as a paragraph holding a space.
    expect(back.content?.[1]).toEqual({ type: 'paragraph' });
  });
});
