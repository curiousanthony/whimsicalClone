import { describe, expect, it } from 'vitest';
import type { MenuItemSpec } from '@shared/menu';
import { allShortcutDefs } from '@renderer/app/editors';
import { ShortcutRegistry } from '@renderer/core/shortcuts';
import { translateKey } from '@renderer/i18n';
import { buildMenuSpec, menuCommandIds } from './menuSpec';

function setup() {
  const registry = new ShortcutRegistry('mac');
  registry.define(allShortcutDefs);
  registry.bind([{ id: 'app.commandMenu', run: () => undefined }]);
  const spec = buildMenuSpec({ registry, translate: (k, v) => translateKey(k, v), theme: 'dark', isDev: false });
  return { registry, spec };
}

function flatten(items: MenuItemSpec[]): MenuItemSpec[] {
  return items.flatMap((i) => (i.type === 'submenu' ? [i, ...flatten(i.items)] : [i]));
}

describe('native menu spec', () => {
  it('has the macOS menus in order', () => {
    const { spec } = setup();
    expect(spec.items.map((i) => (i.type === 'submenu' ? i.label : '?'))).toEqual([
      'Whimsical Clone',
      'File',
      'Edit',
      'View',
      'Arrange',
      'Window',
      'Help',
    ]);
  });

  it('takes accelerators and labels from the registry', () => {
    const { spec } = setup();
    const items = flatten(spec.items);
    const find = (id: string) => items.find((i) => i.type === 'command' && i.commandId === id);
    expect(find('app.commandMenu')).toMatchObject({
      label: 'Open command menu',
      accelerator: 'CmdOrCtrl+K',
      enabled: true,
    });
    expect(find('app.newBoard')).toMatchObject({ accelerator: 'CmdOrCtrl+Alt+N', enabled: false });
    expect(find('canvas.zoomIn')).toMatchObject({ accelerator: '=' });
    expect(find('tab.select2')).toMatchObject({ label: 'Tab 2', accelerator: 'CmdOrCtrl+2' });
    expect(find('app.themeDark')).toMatchObject({ checked: true });
    expect(find('app.themeLight')).toMatchObject({ checked: false });
  });

  it('never uses zoom or close roles, and keeps clipboard roles', () => {
    const { spec } = setup();
    const roles = flatten(spec.items).flatMap((i) => (i.type === 'role' ? [i.role] : []));
    for (const forbidden of ['zoomIn', 'zoomOut', 'resetZoom', 'close']) expect(roles).not.toContain(forbidden);
    for (const required of ['cut', 'copy', 'paste', 'quit']) expect(roles).toContain(required);
    expect(roles).not.toContain('toggleDevTools');
  });

  it('only references defined commands and has no dangling separators', () => {
    const { registry, spec } = setup();
    for (const id of menuCommandIds(spec)) expect(registry.getDef(id)).toBeDefined();
    const check = (items: MenuItemSpec[]) => {
      expect(items[0]?.type).not.toBe('separator');
      expect(items[items.length - 1]?.type).not.toBe('separator');
      items.forEach((item, i) => {
        if (item.type === 'separator') expect(items[i + 1]?.type).not.toBe('separator');
        if (item.type === 'submenu') check(item.items);
      });
    };
    check(spec.items);
  });

  it('adds dev roles only in development', () => {
    const registry = new ShortcutRegistry('mac');
    registry.define(allShortcutDefs);
    const spec = buildMenuSpec({ registry, translate: (k) => translateKey(k), theme: 'system', isDev: true });
    expect(flatten(spec.items).some((i) => i.type === 'role' && i.role === 'toggleDevTools')).toBe(true);
  });
});
