/**
 * Builds the native macOS menu (MenuSpec) from the shortcut registry + i18n (SPEC 6.4).
 * Pure: the registry and translator are injected, so it is unit tested.
 *
 * - Command items carry the registry accelerator for DISPLAY only (main sets
 *   registerAccelerator: false) and are enabled when a handler is bound.
 * - Roles only for the app menu, cut/copy/paste, window management and dev tools. Never the
 *   zoom roles (they steal Cmd+= / Cmd+- / Cmd+0) nor the close role (Cmd+W closes a tab).
 */

import type { ThemePreference } from '@shared/ipc';
import type { MenuItemSpec, MenuSpec } from '@shared/menu';
import type { ShortcutRegistryApi } from '@renderer/core/types';

export interface MenuSpecInput {
  registry: Pick<ShortcutRegistryApi, 'getDef' | 'accelerator' | 'isBound'>;
  /** Translates "ns:key" strings. */
  translate: (key: string, values?: Record<string, unknown>) => string;
  theme: ThemePreference;
  isDev: boolean;
}

export function buildMenuSpec({ registry, translate, theme, isDev }: MenuSpecInput): MenuSpec {
  const m = (key: string) => translate(`menu:${key}`);

  const cmd = (id: string, extra: { checked?: boolean; label?: string } = {}): MenuItemSpec | null => {
    const def = registry.getDef(id);
    if (!def) return null;
    const item: MenuItemSpec = {
      type: 'command',
      commandId: id,
      label: extra.label ?? translate(def.labelKey),
      enabled: registry.isBound(id),
    };
    const accelerator = registry.accelerator(id);
    if (accelerator) item.accelerator = accelerator;
    if (extra.checked !== undefined) item.checked = extra.checked;
    return item;
  };

  const sep: MenuItemSpec = { type: 'separator' };

  /** Drops missing commands and collapses leading / trailing / doubled separators. */
  const items = (...list: (MenuItemSpec | null)[]): MenuItemSpec[] => {
    const out: MenuItemSpec[] = [];
    for (const item of list) {
      if (!item) continue;
      if (item.type === 'separator' && (out.length === 0 || out[out.length - 1]?.type === 'separator')) continue;
      if (item.type === 'submenu' && item.items.length === 0) continue;
      out.push(item);
    }
    while (out[out.length - 1]?.type === 'separator') out.pop();
    return out;
  };

  const submenu = (label: string, list: MenuItemSpec[], role?: 'appMenu' | 'windowMenu' | 'help'): MenuItemSpec => {
    const spec: MenuItemSpec = { type: 'submenu', label, items: list };
    if (role) spec.role = role;
    return spec;
  };

  const app = submenu(
    m('app'),
    items(
      { type: 'role', role: 'about', label: m('about') },
      sep,
      cmd('app.preferences'),
      sep,
      { type: 'role', role: 'hide', label: m('hide') },
      { type: 'role', role: 'hideOthers', label: m('hideOthers') },
      { type: 'role', role: 'unhide', label: m('showAll') },
      sep,
      { type: 'role', role: 'quit', label: m('quit') },
    ),
    'appMenu',
  );

  const file = submenu(
    m('file'),
    items(
      cmd('app.newBoard'),
      submenu(
        m('newSubmenu'),
        items(
          cmd('app.newFlowchart'),
          cmd('app.newMindmap'),
          cmd('app.newWireframe'),
          cmd('app.newDrawing'),
          cmd('app.newDoc'),
          sep,
          cmd('app.newFolder'),
        ),
      ),
      sep,
      cmd('app.openWorkspace'),
      cmd('tab.new'),
      cmd('app.newWindow'),
      sep,
      cmd('tab.close'),
      sep,
      cmd('app.export'),
      cmd('app.print'),
      sep,
      cmd('app.renameFile'),
      cmd('app.toggleFavorite'),
      cmd('app.copyFileLink'),
      cmd('app.revealInFinder'),
      sep,
      cmd('app.deleteFile'),
    ),
  );

  const edit = submenu(
    m('edit'),
    items(
      cmd('edit.undo'),
      cmd('edit.redo'),
      sep,
      { type: 'role', role: 'cut', label: m('cut') },
      { type: 'role', role: 'copy', label: m('copy') },
      { type: 'role', role: 'paste', label: m('paste') },
      { type: 'role', role: 'pasteAndMatchStyle', label: m('pasteAndMatchStyle') },
      cmd('canvas.copyStyle'),
      cmd('canvas.pasteStyle'),
      cmd('canvas.duplicate'),
      cmd('canvas.delete'),
      cmd('edit.selectAll'),
      sep,
      cmd('app.searchFile'),
      cmd('app.searchWorkspace'),
      cmd('app.commandMenu'),
    ),
  );

  const view = submenu(
    m('view'),
    items(
      cmd('app.toggleSidebar'),
      sep,
      cmd('canvas.zoomIn'),
      cmd('canvas.zoomOut'),
      cmd('canvas.zoomReset'),
      cmd('canvas.zoomToFit'),
      cmd('canvas.zoomToSelection'),
      sep,
      cmd('canvas.toggleWireframe'),
      cmd('docs.focusMode'),
      sep,
      submenu(
        m('interfaceColorMode'),
        items(
          cmd('app.themeSystem', { checked: theme === 'system' }),
          cmd('app.themeLight', { checked: theme === 'light' }),
          cmd('app.themeDark', { checked: theme === 'dark' }),
        ),
      ),
      { type: 'role', role: 'togglefullscreen', label: m('toggleFullScreen') },
      sep,
      cmd('app.shortcutsHelp'),
      ...(isDev
        ? [
            sep,
            { type: 'role', role: 'reload', label: m('reload') } as MenuItemSpec,
            { type: 'role', role: 'toggleDevTools', label: m('toggleDevTools') } as MenuItemSpec,
          ]
        : []),
    ),
  );

  const arrange = submenu(
    m('arrange'),
    items(
      cmd('canvas.bringToFront'),
      cmd('canvas.bringForward'),
      cmd('canvas.sendBackward'),
      cmd('canvas.sendToBack'),
      sep,
      cmd('canvas.group'),
      cmd('canvas.ungroup'),
      cmd('canvas.lock'),
      sep,
      submenu(
        m('align'),
        items(
          cmd('canvas.alignLeft'),
          cmd('canvas.alignCenterH'),
          cmd('canvas.alignRight'),
          sep,
          cmd('canvas.alignTop'),
          cmd('canvas.alignCenterV'),
          cmd('canvas.alignBottom'),
        ),
      ),
      submenu(
        m('distribute'),
        items(cmd('canvas.distributeH'), cmd('canvas.distributeV'), cmd('board.distributeGrid')),
      ),
      submenu(
        m('layout'),
        items(cmd('flowchart.layoutVertical'), cmd('flowchart.layoutHorizontal'), cmd('mindmap.relayout')),
      ),
      sep,
      cmd('canvas.rotate'),
      cmd('canvas.wrapInSection'),
      cmd('canvas.snapToGrid'),
    ),
  );

  const window = submenu(
    m('window'),
    items(
      { type: 'role', role: 'minimize', label: m('minimize') },
      { type: 'role', role: 'zoom', label: m('zoom') },
      sep,
      cmd('tab.next'),
      cmd('tab.previous'),
      sep,
      ...Array.from({ length: 9 }, (_, i) =>
        cmd(`tab.select${i + 1}`, { label: i === 8 ? m('lastTab') : translate('menu:tabN', { n: i + 1 }) }),
      ),
      sep,
      { type: 'role', role: 'front', label: m('bringAllToFront') },
    ),
    'windowMenu',
  );

  const help = submenu(m('help'), items(cmd('app.shortcutsHelp')), 'help');

  return { items: [app, file, edit, view, arrange, window, help] };
}

/** Every command id referenced by a menu spec (for tests and enable-state tracking). */
export function menuCommandIds(spec: MenuSpec): string[] {
  const out: string[] = [];
  const walk = (list: MenuItemSpec[]) => {
    for (const item of list) {
      if (item.type === 'command') out.push(item.commandId);
      else if (item.type === 'submenu') walk(item.items);
    }
  };
  walk(spec.items);
  return out;
}
