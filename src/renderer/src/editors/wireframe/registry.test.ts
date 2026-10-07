import { describe, expect, it } from 'vitest';
import { i18n } from '@renderer/i18n';
import type { WireElement } from '@renderer/core/types';
import {
  LAUNCHER_ENTRIES,
  ROW_HEIGHT,
  WIRE_ENTRIES,
  WIRE_KINDS,
  autoWidthFor,
  buildProps,
  dropdownHeight,
  entryOf,
  launcherEntry,
  normalizeWire,
  sizePatch,
  statePatch,
} from './registry';

const t = (key: string) => i18n.t(`wireframe:${key}` as never) as string;

function wire(partial: Partial<WireElement> & Pick<WireElement, 'component'>): WireElement {
  const entry = entryOf(partial.component);
  return {
    id: 'w1',
    type: 'wire',
    x: 0,
    y: 0,
    w: entry.sizes.M.w,
    h: entry.sizes.M.h,
    size: 'M',
    state: entry.defaultState,
    text: { blocks: [{ type: 'p', spans: [] }] },
    textSize: 'm',
    props: entry.props(t),
    ...partial,
  };
}

describe('component registry', () => {
  it('has the 29 components of the Whimsical kit', () => {
    expect(WIRE_KINDS).toHaveLength(29);
    for (const kind of WIRE_KINDS) expect(WIRE_ENTRIES[kind].kind).toBe(kind);
  });

  it('keeps default boxes on the 4 px rhythm', () => {
    for (const kind of WIRE_KINDS) {
      for (const size of ['S', 'M', 'L'] as const) {
        const { w, h } = WIRE_ENTRIES[kind].sizes[size];
        expect(w % 4, `${kind} ${size} width`).toBe(0);
        expect(h % 4, `${kind} ${size} height`).toBe(0);
      }
    }
  });

  it('has one launcher row per component plus the outline button, with unique ids', () => {
    const ids = LAUNCHER_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(30);
    expect(ids[0]).toBe('rectangle');
    expect(ids.indexOf('outlineButton')).toBe(ids.indexOf('button') + 1);
    expect(launcherEntry('outlineButton')?.props).toEqual({ variant: 'outline' });
  });

  it('translates every launcher label, keyword list and default text', () => {
    for (const entry of LAUNCHER_ENTRIES) {
      expect(i18n.exists(entry.labelKey), entry.labelKey).toBe(true);
      expect(i18n.exists(entry.keywordsKey), entry.keywordsKey).toBe(true);
    }
    for (const kind of WIRE_KINDS) {
      const key = WIRE_ENTRIES[kind].defaultTextKey;
      if (key) expect(i18n.exists(`wireframe:${key}`), key).toBe(true);
    }
  });

  it('translates default props when an element is created', () => {
    const french = (key: string) => `fr:${key}`;
    expect(buildProps('dropdown', french).options).toEqual(['fr:defaults.option1', 'fr:defaults.option2']);
    expect(buildProps('mobileTabs', french).items).toEqual([
      'fr:defaults.tabHome',
      'fr:defaults.tabSearch',
      'fr:defaults.tabProfile',
    ]);
    expect(buildProps('button', t, { variant: 'outline' }, { autoWidth: false })).toMatchObject({
      variant: 'outline',
      autoWidth: false,
    });
  });

  it('normalises loaded elements without injecting translatable defaults', () => {
    const el = wire({ component: 'dropdown', props: {} });
    const n = normalizeWire(el);
    expect(n.props.options).toBeUndefined();
    expect(n.props.selected).toBe(0);
    const b = normalizeWire(wire({ component: 'button', props: {} }));
    expect(b.props).toEqual({ variant: 'solid', autoWidth: true });
    // Already complete elements are returned as is.
    const full = wire({ component: 'button' });
    expect(normalizeWire(full)).toBe(full);
  });

  it('S / M / L change box, text size and open dropdown height', () => {
    const button = wire({ component: 'button', w: 150 });
    expect(sizePatch(button, 'L')).toMatchObject({ size: 'L', h: 40, textSize: 'l', w: 150 });
    const avatar = wire({ component: 'avatar' });
    expect(sizePatch(avatar, 'L')).toMatchObject({ w: 64, h: 64 });
    const dropdown = wire({ component: 'dropdown', state: 'open' });
    expect(sizePatch(dropdown, 'S').h).toBe(dropdownHeight('S', 'open', 2));
    expect(statePatch(dropdown, 'default').h).toBe(ROW_HEIGHT.M);
    expect(statePatch(wire({ component: 'dropdown' }), 'open').h).toBe(ROW_HEIGHT.M * 3);
  });

  it('auto width follows the label on the 4 px rhythm', () => {
    expect(autoWidthFor('button', 'M', 40, false)).toBe(72);
    expect(autoWidthFor('button', 'M', 10, false)).toBe(48);
    expect(autoWidthFor('button', 'M', 40, true) % 4).toBe(0);
    expect(autoWidthFor('link', 'M', 60, false)).toBe(60);
    expect(autoWidthFor('tag', 'M', 4, false)).toBe(32);
  });
});
