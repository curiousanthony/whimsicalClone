import { describe, expect, it } from 'vitest';
import { translateKey } from '@renderer/i18n';
import { FRAME_LAUNCHER_ORDER } from './frames';
import { launcherAction } from './commands';
import { SINGLE_LINE, TEXTUAL, blockLineWidths, starFill } from './drawModel';
import { allIconNames, lucideByName, pascalToKebab, kebabToPascal, searchIcons } from './icons';
import { filterDevices, filterLauncher } from './launcherModel';
import { LAUNCHER_ENTRIES } from './registry';
import { COMPONENTS_TOOL, FRAMES_TOOL, toolIdForDevice, toolIdForEntry, wireframeTools } from './tools';

describe('launcher filtering', () => {
  const ids = (q: string) => filterLauncher(LAUNCHER_ENTRIES, q, translateKey).map((e) => e.id);

  it('keeps the fixed order with an empty query', () => {
    expect(ids('')).toEqual(LAUNCHER_ENTRIES.map((e) => e.id));
    expect(ids('   ')).toHaveLength(LAUNCHER_ENTRIES.length);
  });

  it('finds components by name and keyword', () => {
    expect(ids('overlay')).toEqual(['overlay']);
    expect(ids('modal')).toEqual(['overlay']);
    expect(ids('textfield')).toContain('input');
    expect(ids('select')).toEqual(expect.arrayContaining(['dropdown', 'radio']));
    expect(ids('OUTLINE')).toContain('outlineButton');
    expect(ids('zzzz')).toEqual([]);
  });

  it('requires every word', () => {
    expect(ids('tab bar')).toEqual(expect.arrayContaining(['mobileTabs', 'horizontalTabs']));
    expect(ids('tab bar zebra')).toEqual([]);
  });

  it('filters devices', () => {
    const devices = (q: string) => filterDevices(FRAME_LAUNCHER_ORDER, q, translateKey);
    expect(devices('')).toEqual([...FRAME_LAUNCHER_ORDER]);
    expect(devices('iphone')).toEqual(['iphone-14', 'iphone-x', 'iphone-8']);
    expect(devices('tablet')).toEqual(expect.arrayContaining(['ipad', 'android-tablet']));
    expect(devices('watch')).toEqual(['apple-watch']);
  });
});

describe('tool table', () => {
  it('has unique tool ids', () => {
    const ids = wireframeTools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers a place tool for every launcher entry and device', () => {
    const ids = new Set(wireframeTools.map((t) => t.id));
    for (const entry of LAUNCHER_ENTRIES) expect(ids.has(toolIdForEntry(entry.id)), entry.id).toBe(true);
    for (const device of FRAME_LAUNCHER_ORDER) expect(ids.has(toolIdForDevice(device)), device).toBe(true);
    expect(ids.has(COMPONENTS_TOOL) && ids.has(FRAMES_TOOL)).toBe(true);
  });

  it('keys equal tool ids so the canvas binds them', () => {
    const keyed = wireframeTools.filter((t) => t.shortcutId && t.create);
    for (const tool of keyed) expect(tool.id).toBe(tool.shortcutId);
    expect(keyed.map((t) => t.id).sort()).toEqual(
      [
        'wireframe.annotation',
        'wireframe.avatar',
        'wireframe.button',
        'wireframe.circle',
        'wireframe.image',
        'wireframe.input',
        'wireframe.line',
        'wireframe.rectangle',
      ].sort(),
    );
  });

  it('keeps the toolbar groups usable: only direct-key components in the flyout', () => {
    const inFlyout = wireframeTools.filter((t) => t.group === 'wireframeComponents').map((t) => t.id);
    expect(inFlyout).toEqual([
      'wireframe.components',
      'wireframe.rectangle',
      'wireframe.button',
      'wireframe.image',
      'wireframe.input',
      'wireframe.avatar',
      'wireframe.circle',
      'wireframe.line',
    ]);
    expect(wireframeTools.filter((t) => t.group === 'wireframeFrames').map((t) => t.id)).toEqual(['wireframe.frames']);
  });

  it('offers the annotation tool in both modes and the rest in wireframe mode only', () => {
    for (const tool of wireframeTools) {
      if (tool.id === 'wireframe.annotation') expect(tool.modes).toEqual(['diagram', 'wireframe']);
      else expect(tool.modes).toEqual(['wireframe']);
    }
  });
});

describe('launcher glue', () => {
  const idle = { tool: 'canvas.selectTool', panel: undefined };
  it('opens the panel when a launcher tool becomes active', () => {
    expect(launcherAction({ tool: COMPONENTS_TOOL, panel: undefined }, idle)).toEqual({ open: 'wireframe.components' });
    expect(launcherAction({ tool: FRAMES_TOOL, panel: undefined }, idle)).toEqual({ open: 'wireframe.frames' });
    expect(launcherAction({ tool: COMPONENTS_TOOL, panel: { id: 'wireframe.components' } }, idle)).toEqual({});
  });

  it('returns to Select when the panel closes without a pick', () => {
    const open = { tool: COMPONENTS_TOOL, panel: { id: 'wireframe.components' } };
    expect(launcherAction({ tool: COMPONENTS_TOOL, panel: undefined }, open)).toEqual({ reset: true });
    // A pick arms another tool afterwards: nothing to reset.
    expect(launcherAction({ tool: 'wireframe.button', panel: undefined }, open)).toEqual({});
  });
});

describe('render helpers', () => {
  it('draws block text lines with a short last line', () => {
    expect(blockLineWidths(1)).toEqual([1]);
    const lines = blockLineWidths(5);
    expect(lines).toHaveLength(5);
    expect(lines[4]).toBe(0.6);
  });

  it('fills stars by half steps', () => {
    expect([0, 1, 2, 3, 4].map((i) => starFill(2.5, i))).toEqual([1, 1, 0.5, 0, 0]);
    expect(starFill(5, 4)).toBe(1);
  });
});

describe('labels', () => {
  it('only edits text of textual components, single-line ones finish with Enter', () => {
    for (const kind of SINGLE_LINE) expect(TEXTUAL.has(kind), kind).toBe(true);
    expect(SINGLE_LINE.has('textarea')).toBe(false);
    expect(SINGLE_LINE.has('rectangle')).toBe(false);
  });
});

describe('icon library', () => {
  it('converts between kebab and Pascal names', () => {
    expect(pascalToKebab('CircleUserRound')).toBe('circle-user-round');
    expect(pascalToKebab('Grid3x3')).toBe('grid-3x3');
    expect(kebabToPascal('circle-user-round')).toBe('CircleUserRound');
  });

  it('offers canonical icons only and resolves stored names', () => {
    const names = allIconNames();
    expect(names.length).toBeGreaterThan(1500);
    expect(names).toContain('star');
    expect(names).not.toContain('home');
    expect(lucideByName('star')).toBeDefined();
    // Aliases of older files still render.
    expect(lucideByName('home')).toBeDefined();
    expect(lucideByName('not-an-icon')).toBeUndefined();
    expect(lucideByName(undefined)).toBeUndefined();
    // Every icon of the wireframe registry exists.
    for (const stored of [
      'house',
      'search',
      'user',
      'image',
      'play',
      'check',
      'chevron-down',
      'chevron-up',
      'star',
      'circle',
    ]) {
      expect(lucideByName(stored), stored).toBeDefined();
    }
  });

  it('searches by whole word first', () => {
    expect(searchIcons('star')[0]).toBe('star');
    expect(searchIcons('arrow right').every((n) => n.includes('arrow') && n.includes('right'))).toBe(true);
    expect(searchIcons('zzzzqq')).toEqual([]);
    expect(searchIcons('', undefined, 5)).toHaveLength(5);
  });
});
