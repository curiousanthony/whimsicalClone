import { describe, expect, it } from 'vitest';
import { richTextFromPlain } from '@renderer/core/richText';
import {
  createImageElement,
  createSectionElement,
  createStickyElement,
  createTextElement,
  kebabToPascal,
  linkDisplayTitle,
  linkSubtitle,
  linkTarget,
  normalizeLink,
  normalizeLinkUrl,
  normalizeSticky,
  pascalToKebab,
  STICKY_SIZE,
} from './model';
import { allIconNames, lucideIcon, searchIcons } from './iconLibrary';

describe('sticky factory', () => {
  it('creates a purple auto-sizing 168px note', () => {
    const s = createStickyElement({ id: 'a', x: 12, y: 24 });
    expect(s).toMatchObject({ type: 'sticky', x: 12, y: 24, w: STICKY_SIZE, h: STICKY_SIZE, color: 'purple', autoSize: true });
  });
  it('follows the last-used style but never lets it override geometry or identity', () => {
    const s = createStickyElement({ id: 'a', x: 0, y: 0, style: { color: 'yellow', textSize: 'l', x: 999, id: 'evil', autoSize: false } });
    expect(s.color).toBe('yellow');
    expect(s.textSize).toBe('l');
    expect(s.x).toBe(0);
    expect(s.id).toBe('a');
    expect(s.autoSize).toBe(true);
  });
  it('a dragged rect makes the note manually sized', () => {
    const s = createStickyElement({ id: 'a', x: 0, y: 0, rect: { x: 5, y: 6, w: 240, h: 240 } });
    expect(s).toMatchObject({ x: 5, y: 6, w: 240, h: 240, autoSize: false });
  });
});

describe('other factories', () => {
  it('text starts with auto width', () => {
    expect(createTextElement({ id: 't', x: 1, y: 2 }).autoWidth).toBe(true);
    expect(createTextElement({ id: 't', x: 1, y: 2, rect: { x: 0, y: 0, w: 200, h: 40 } }).autoWidth).toBe(false);
  });
  it('section keeps given name and geometry', () => {
    const s = createSectionElement({ id: 's', x: 0, y: 0, name: 'Plan', rect: { x: 10, y: 10, w: 100, h: 80 }, style: { name: 'x', w: 1 } });
    expect(s).toMatchObject({ name: 'Plan', w: 100, h: 80, fill: 'outline' });
  });
  it('image is scaled down to the max width and centred', () => {
    const img = createImageElement({ id: 'i', centre: { x: 0, y: 0 }, url: 'wsasset://a.png', width: 960, height: 480 });
    expect(img.w).toBe(480);
    expect(img.h).toBe(240);
    expect(img.x).toBe(-240);
    expect(img.y).toBe(-120);
  });
  it('image keeps small sizes', () => {
    const img = createImageElement({ id: 'i', centre: { x: 100, y: 100 }, url: 'u', width: 100, height: 50 });
    expect(img).toMatchObject({ w: 100, h: 50, x: 50, y: 75 });
  });
});

describe('links', () => {
  it('normalises bare hosts, emails and schemes', () => {
    expect(normalizeLinkUrl('example.com/a')).toBe('https://example.com/a');
    expect(normalizeLinkUrl('http://x.io')).toBe('http://x.io');
    expect(normalizeLinkUrl('me@example.com')).toBe('mailto:me@example.com');
    expect(normalizeLinkUrl('localhost:3000')).toBe('https://localhost:3000');
    expect(normalizeLinkUrl('   ')).toBe('');
  });
  it('recognises workspace file links', () => {
    expect(linkTarget('wc://file/Notes/My%20doc.md#x')).toEqual({ kind: 'file', path: 'Notes/My doc.md' });
    expect(linkTarget('https://a.b')).toEqual({ kind: 'external', url: 'https://a.b' });
    expect(linkTarget('nonsense')).toEqual({ kind: 'invalid' });
  });
  it('derives titles and subtitles', () => {
    expect(linkDisplayTitle({ url: 'https://www.example.com/x' }, 'Link')).toBe('example.com');
    expect(linkDisplayTitle({ url: 'wc://file/a/Plan.wflow' }, 'Link')).toBe('Plan');
    expect(linkDisplayTitle({ url: '', title: ' Mine ' }, 'Link')).toBe('Mine');
    expect(linkDisplayTitle({ url: '' }, 'Link')).toBe('Link');
    expect(linkSubtitle('https://example.com/')).toBe('example.com');
  });
});

describe('icon names', () => {
  it('converts between kebab and pascal case', () => {
    expect(kebabToPascal('circle-user-round')).toBe('CircleUserRound');
    expect(pascalToKebab('CircleUserRound')).toBe('circle-user-round');
    expect(pascalToKebab('Grid3x3')).toBe('grid-3x3');
    expect(kebabToPascal(pascalToKebab('Wifi'))).toBe('Wifi');
  });
  it('resolves and searches lucide icons', () => {
    expect(lucideIcon('star')).toBeDefined();
    expect(lucideIcon('definitely-not-an-icon')).toBeUndefined();
    expect(searchIcons('star')[0]).toBe('star');
    // every listed name must resolve back to its component (stored names are kebab-case)
    for (const name of allIconNames()) expect(lucideIcon(name), name).toBeDefined();
    expect(searchIcons('zzzzqq')).toEqual([]);
  });
});

describe('normalisers', () => {
  it('fill defaults for hand edited files and keep complete elements by reference', () => {
    const complete = createStickyElement({ id: 'a', x: 0, y: 0 });
    expect(normalizeSticky(complete)).toBe(complete);
    const partial = normalizeSticky({ id: 'b', type: 'sticky', x: 0, y: 0, w: 168, h: 168 } as never);
    expect(partial.color).toBe('purple');
    expect(partial.autoSize).toBe(true);
    expect(normalizeLink({ id: 'l', type: 'link', x: 0, y: 0, w: 1, h: 1 } as never)).toMatchObject({ url: '', display: 'card' });
  });
  it('rich text survives', () => {
    const s = createStickyElement({ id: 'a', x: 0, y: 0, text: richTextFromPlain('hi') });
    expect(s.text.blocks[0]?.spans[0]?.text).toBe('hi');
  });
});
