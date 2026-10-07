/**
 * Converts the renderer's MenuSpec into an Electron menu. Command items only DISPLAY their
 * accelerator (`registerAccelerator: false`); the renderer shortcut registry handles keys and
 * a click sends `app:menuCommand`. Only whitelisted roles are honoured; zoom and close roles
 * are never created.
 */

import type { MenuItemConstructorOptions } from 'electron';
import type { MenuItemSpec, MenuRole, MenuSpec } from '@shared/menu';

const ALLOWED_ROLES: Record<MenuRole, MenuItemConstructorOptions['role']> = {
  about: 'about',
  services: 'services',
  hide: 'hide',
  hideOthers: 'hideOthers',
  unhide: 'unhide',
  quit: 'quit',
  cut: 'cut',
  copy: 'copy',
  paste: 'paste',
  pasteAndMatchStyle: 'pasteAndMatchStyle',
  minimize: 'minimize',
  zoom: 'zoom',
  front: 'front',
  togglefullscreen: 'togglefullscreen',
  toggleDevTools: 'toggleDevTools',
  reload: 'reload',
};

export interface MenuBuildOptions {
  onCommand: (commandId: string) => void;
  /** Drop accelerators entirely (fallback when Electron rejects one). */
  withoutAccelerators?: boolean;
  isDev?: boolean;
}

function convert(item: MenuItemSpec, options: MenuBuildOptions): MenuItemConstructorOptions | null {
  switch (item.type) {
    case 'separator':
      return { type: 'separator' };
    case 'role': {
      const role = ALLOWED_ROLES[item.role];
      if (!role) return null;
      if ((item.role === 'toggleDevTools' || item.role === 'reload') && !options.isDev) return null;
      return item.label ? { role, label: item.label } : { role };
    }
    case 'command': {
      const out: MenuItemConstructorOptions = {
        label: item.label,
        enabled: item.enabled ?? true,
        click: () => options.onCommand(item.commandId),
      };
      if (item.accelerator && !options.withoutAccelerators) {
        out.accelerator = item.accelerator;
        out.registerAccelerator = false;
      }
      if (item.checked !== undefined) {
        out.type = 'checkbox';
        out.checked = item.checked;
      }
      return out;
    }
    case 'submenu': {
      const submenu = item.items
        .map((i) => convert(i, options))
        .filter((i): i is MenuItemConstructorOptions => i !== null);
      const out: MenuItemConstructorOptions = { label: item.label, submenu };
      // The first top-level menu is the app menu on macOS; no role needed (a role with a
      // default submenu could replace ours).
      if (item.role === 'windowMenu') out.role = 'windowMenu';
      if (item.role === 'help') out.role = 'help';
      return out;
    }
    default:
      return null;
  }
}

export function menuTemplate(spec: MenuSpec, options: MenuBuildOptions): MenuItemConstructorOptions[] {
  return spec.items.map((i) => convert(i, options)).filter((i): i is MenuItemConstructorOptions => i !== null);
}
