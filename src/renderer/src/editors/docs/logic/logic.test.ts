import { describe, expect, it } from 'vitest';
import {
  DOUBLE_STAR_BOLD_INPUT,
  EMOJI_INPUT,
  LINE_DIVIDER_INPUT,
  SECTION_DIVIDER_INPUT,
  STAR_BOLD_INPUT,
  TILDE_STRIKE_INPUT,
  UNDERSCORE_CHECKLIST_INPUT,
  UNDERSCORE_ITALIC_INPUT,
  surroundWith,
} from './inputRules';
import { activeOutlineIndex, buildOutline, outlineDepth, outlineFromDoc } from './outline';
import { countWords, docStats } from './stats';
import { isTextSize, layoutCssVars, layoutMetrics, stepTextSize } from './layout';
import { SLASH_ITEMS, filterSlashItems } from './slashItems';
import {
  collapseAllBelow,
  expandOneLevel,
  headingKeys,
  hiddenBlocks,
  sectionEnd,
  toggleCollapsed,
  toggleTargets,
  type BlockInfo,
} from './collapse';
import { looksLikeMarkdown, parseTsvTable, tableJson } from './paste';
import { parseEmbedUrl } from './embedUrl';
import { markdownToDoc } from '../markdown/parse';
import { en } from './enLabels';
import { filterFiles, flattenFiles } from './mention';
import { classifyHref, normalizeHref } from './link';
import { shortcutLabel } from './shortcutLabels';

describe('input rules', () => {
  it('single star makes bold, double star too', () => {
    expect(STAR_BOLD_INPUT.exec('say *hello*')?.[2]).toBe('hello');
    expect(STAR_BOLD_INPUT.exec('*hello*')?.[2]).toBe('hello');
    expect(STAR_BOLD_INPUT.test('**hello*')).toBe(false);
    expect(DOUBLE_STAR_BOLD_INPUT.exec('a **hello**')?.[2]).toBe('hello');
    expect(STAR_BOLD_INPUT.test('2 * 3 * 4')).toBe(false);
  });

  it('underscore italic, not inside words', () => {
    expect(UNDERSCORE_ITALIC_INPUT.exec('an _idea_')?.[2]).toBe('idea');
    expect(UNDERSCORE_ITALIC_INPUT.test('snake_case_name')).toBe(false);
  });

  it('tilde strike', () => {
    expect(TILDE_STRIKE_INPUT.exec('~gone~')?.[2]).toBe('gone');
  });

  it('underscore + space starts a checklist, only at block start', () => {
    expect(UNDERSCORE_CHECKLIST_INPUT.test('_ ')).toBe(true);
    expect(UNDERSCORE_CHECKLIST_INPUT.test('a _ ')).toBe(false);
  });

  it('dividers', () => {
    expect(LINE_DIVIDER_INPUT.test('---')).toBe(true);
    expect(LINE_DIVIDER_INPUT.test('--')).toBe(false);
    expect(SECTION_DIVIDER_INPUT.test('***')).toBe(true);
  });

  it('emoji shortcodes', () => {
    expect(EMOJI_INPUT.exec('hi :bulb:')?.[2]).toBe('bulb');
    expect(EMOJI_INPUT.test('12:30:45')).toBe(false);
  });

  it('surround pairs', () => {
    expect(surroundWith('(')).toBe(')');
    expect(surroundWith('"')).toBe('"');
    expect(surroundWith('a')).toBeNull();
  });
});

describe('outline', () => {
  const doc = markdownToDoc('# One\n\ntext\n\n## Two\n\n## \n\n### Three\n\n> # Quoted\n');
  it('builds an outline from a document', () => {
    const items = outlineFromDoc(doc);
    expect(items.map((i) => [i.level, i.text])).toEqual([
      [1, 'One'],
      [2, 'Two'],
      [3, 'Three'],
      [1, 'Quoted'],
    ]);
    expect(outlineDepth(items, items[2]!)).toBe(2);
  });
  it('active heading follows position', () => {
    const items = buildOutline([
      { level: 1, text: 'A', pos: 0 },
      { level: 2, text: 'B', pos: 50 },
    ]);
    expect(activeOutlineIndex(items, 10)).toBe(0);
    expect(activeOutlineIndex(items, 60)).toBe(1);
    expect(activeOutlineIndex(items, -1)).toBe(-1);
  });
});

describe('stats', () => {
  it('counts words with punctuation and unicode', () => {
    expect(countWords("Hello, world! It's état-civil 42.")).toBe(5);
    expect(countWords('')).toBe(0);
  });
  it('counts blocks and words of a doc', () => {
    const doc = markdownToDoc('# Title\n\nOne two three.\n\n- a\n- b\n\n| x | y |\n| --- | --- |\n| 1 | 2 |\n');
    const stats = docStats(doc);
    expect(stats.blocks).toBe(2 + 2 + 4);
    expect(stats.words).toBe(1 + 3 + 2 + 4);
  });
});

describe('layout', () => {
  it('defaults are large and narrow, wide is wider', () => {
    expect(layoutMetrics('large', 'narrow').fontSize).toBeGreaterThan(layoutMetrics('small', 'narrow').fontSize);
    expect(layoutMetrics('large', 'wide').columnWidth).toBeGreaterThan(layoutMetrics('large', 'narrow').columnWidth);
    expect(layoutCssVars('medium', 'wide')['--doc-font-size']).toBe('16px');
  });
  it('steps and clamps', () => {
    expect(stepTextSize('large', 'up')).toBe('large');
    expect(stepTextSize('large', 'down')).toBe('medium');
    expect(stepTextSize('small', 'down')).toBe('small');
    expect(isTextSize('huge')).toBe(false);
  });
});

describe('slash menu', () => {
  const labelOf = (item: { labelKey: string }): string => en(item.labelKey);
  it('has the 22 items in Whimsical order', () => {
    expect(SLASH_ITEMS).toHaveLength(22);
    expect(SLASH_ITEMS.slice(0, 4).map((i) => i.id)).toEqual(['paragraph', 'heading1', 'heading2', 'heading3']);
    expect(SLASH_ITEMS[21]?.id).toBe('emoji');
    expect(new Set(SLASH_ITEMS.map((i) => i.id)).size).toBe(22);
  });
  it('every item has an English label', () => {
    for (const item of SLASH_ITEMS) expect(en(item.labelKey), item.id).not.toBe(item.labelKey);
  });
  it('keeps the menu order for an empty query', () => {
    expect(filterSlashItems(SLASH_ITEMS, '', labelOf)).toHaveLength(22);
  });
  it('ranks prefix matches first and matches keywords', () => {
    expect(filterSlashItems(SLASH_ITEMS, 'head', labelOf).map((i) => i.id)).toEqual(['heading1', 'heading2', 'heading3']);
    expect(filterSlashItems(SLASH_ITEMS, 'todo', labelOf)[0]?.id).toBe('checklist');
    expect(filterSlashItems(SLASH_ITEMS, 'tab', labelOf)[0]?.id).toBe('table');
    expect(filterSlashItems(SLASH_ITEMS, 'zzzz', labelOf)).toEqual([]);
  });
  it('ignores accents and case', () => {
    expect(filterSlashItems(SLASH_ITEMS, 'CÓDE', labelOf)[0]?.id).toBe('codeBlock');
  });
});

describe('collapsible headings', () => {
  // # A, p, ## B, p, ### C, p, ## D, p, # E, p
  const blocks: BlockInfo[] = [
    { level: 1, text: 'A' },
    { level: null, text: '' },
    { level: 2, text: 'B' },
    { level: null, text: '' },
    { level: 3, text: 'C' },
    { level: null, text: '' },
    { level: 2, text: 'D' },
    { level: null, text: '' },
    { level: 1, text: 'E' },
    { level: null, text: '' },
  ];
  const keys = headingKeys(blocks);

  it('keys are stable and unique for repeated headings', () => {
    const k = headingKeys([
      { level: 2, text: 'X' },
      { level: 2, text: 'X' },
    ]);
    expect(k).toEqual(['2:X:0', '2:X:1']);
  });

  it('section ends at the next heading of equal or higher level', () => {
    expect(sectionEnd(blocks, 0)).toBe(8);
    expect(sectionEnd(blocks, 2)).toBe(6);
    expect(sectionEnd(blocks, 4)).toBe(6);
  });

  it('hides the blocks beneath collapsed headings', () => {
    expect([...hiddenBlocks(blocks, new Set([keys[2]!]))].sort()).toEqual([3, 4, 5]);
    expect([...hiddenBlocks(blocks, new Set([keys[0]!]))].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('modifier targets', () => {
    expect(toggleTargets(blocks, 2)).toEqual([2]);
    expect(toggleTargets(blocks, 2, { alt: true })).toEqual([2, 4]);
    expect(toggleTargets(blocks, 2, { shift: true })).toEqual([2, 6]);
    expect(toggleTargets(blocks, 2, { alt: true, shift: true })).toEqual([2, 4, 6]);
    expect(toggleTargets(blocks, 1)).toEqual([]);
  });

  it('toggle collapses then expands', () => {
    const collapsed = toggleCollapsed(blocks, new Set(), 2, { alt: true });
    expect(collapsed.has(keys[2]!) && collapsed.has(keys[4]!)).toBe(true);
    expect(toggleCollapsed(blocks, collapsed, 2, { alt: true }).size).toBe(0);
  });

  it('expand reveals one level at a time, collapse hides all below', () => {
    const all = collapseAllBelow(blocks, new Set(), 0);
    expect([keys[0], keys[2], keys[4], keys[6]].every((k) => all.has(k!))).toBe(true);
    const step1 = expandOneLevel(blocks, all, 0);
    expect(step1.has(keys[0]!)).toBe(false);
    expect(step1.has(keys[2]!)).toBe(true);
    const step2 = expandOneLevel(blocks, step1, 0);
    expect(step2.has(keys[2]!)).toBe(false);
    expect(step2.has(keys[6]!)).toBe(false);
    expect(step2.has(keys[4]!)).toBe(true);
  });
});

describe('paste heuristics', () => {
  it('detects Markdown in plain text', () => {
    expect(looksLikeMarkdown('# Title\n\ntext')).toBe(true);
    expect(looksLikeMarkdown('- a\n- b')).toBe(true);
    expect(looksLikeMarkdown('some **bold** text')).toBe(true);
    expect(looksLikeMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe(true);
    expect(looksLikeMarkdown('just a sentence.')).toBe(false);
    expect(looksLikeMarkdown('   ')).toBe(false);
  });
  it('parses tab separated tables', () => {
    expect(parseTsvTable('a\tb\n1\t2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseTsvTable('a\tb')).toBeNull();
    expect(parseTsvTable('a\tb\n1')).toBeNull();
    expect(JSON.stringify(tableJson([['a', 'b']]))).toContain('tableHeader');
  });
});

describe('embed urls', () => {
  it('recognises providers', () => {
    expect(parseEmbedUrl('https://www.youtube.com/watch?v=1')?.provider).toBe('youtube');
    expect(parseEmbedUrl('https://figma.com/file/x')?.provider).toBe('figma');
    expect(parseEmbedUrl('https://example.com')?.provider).toBe('link');
    expect(parseEmbedUrl('not a url')).toBeNull();
    expect(parseEmbedUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('mention + link helpers', () => {
  const tree = {
    path: '',
    name: '',
    type: 'folder' as const,
    mtimeMs: 0,
    children: [
      { path: 'Roadmap.wboard', name: 'Roadmap.wboard', type: 'file' as const, kind: 'board' as const, mtimeMs: 5 },
      { path: 'Notes', name: 'Notes', type: 'folder' as const, mtimeMs: 1, children: [
        { path: 'Notes/Meeting notes.md', name: 'Meeting notes.md', type: 'file' as const, kind: 'doc' as const, mtimeMs: 9 },
        { path: 'Notes/readme.txt', name: 'readme.txt', type: 'file' as const, kind: null, mtimeMs: 2 },
      ] },
    ],
  };
  it('flattens only app documents', () => {
    const files = flattenFiles(tree);
    expect(files.map((f) => f.path)).toEqual(['Roadmap.wboard', 'Notes/Meeting notes.md']);
    expect(files[1]).toMatchObject({ name: 'Meeting notes', folder: 'Notes', kind: 'doc' });
  });
  it('filters and ranks files', () => {
    const files = flattenFiles(tree);
    expect(filterFiles(files, '').map((f) => f.name)).toEqual(['Meeting notes', 'Roadmap']);
    expect(filterFiles(files, 'road')[0]?.name).toBe('Roadmap');
    expect(filterFiles(files, 'notes')[0]?.name).toBe('Meeting notes');
    expect(filterFiles(files, '', 'Roadmap.wboard').map((f) => f.name)).toEqual(['Meeting notes']);
    expect(filterFiles(files, 'zzz')).toEqual([]);
  });
  it('normalises hrefs', () => {
    expect(normalizeHref('example.com')).toBe('https://example.com');
    expect(normalizeHref('https://a.b/c')).toBe('https://a.b/c');
    expect(normalizeHref('me@site.org')).toBe('mailto:me@site.org');
    expect(normalizeHref('wc://file/A.md')).toBe('wc://file/A.md');
    expect(normalizeHref('javascript:alert(1)')).toBeNull();
    expect(normalizeHref('  ')).toBeNull();
    expect(normalizeHref('just words')).toBeNull();
  });
  it('classifies links', () => {
    expect(classifyHref('wc://file/A/B.md#block-3')).toEqual({ kind: 'file', path: 'A/B.md', anchor: 'block-3' });
    expect(classifyHref('https://x.y')).toEqual({ kind: 'external', url: 'https://x.y' });
    expect(classifyHref('#block-2')).toEqual({ kind: 'anchor', id: 'block-2' });
    expect(classifyHref('ftp://x')).toBeNull();
  });
  it('shortcut labels come from the docs table', () => {
    expect(shortcutLabel('docs.bold')).toBe('⌘B');
    expect(shortcutLabel('docs.mdChecklist')).toBeUndefined();
  });
});
