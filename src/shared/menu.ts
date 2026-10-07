/**
 * Native menu description sent from the renderer to main (`api.app.setMenu`).
 *
 * The renderer builds it from the shortcut registry + i18n so labels are translated and
 * accelerators are a single source of truth. Main turns it into an Electron Menu:
 *   - `role` items use Electron roles (only cut/copy/paste/pasteAndMatchStyle, app-menu
 *     roles such as about/hide/quit, and window roles minimize/zoom/front/togglefullscreen).
 *   - `command` items get `registerAccelerator: false`: the accelerator is DISPLAYED only;
 *     the keystroke is handled by the renderer shortcut registry. Clicking the item sends
 *     `IPC.appMenuCommand` with `commandId`. This avoids double dispatch and keeps bare
 *     letter shortcuts (R, N, W...) from being stolen while typing.
 *   - Never include Electron's default View zoom roles (they steal Cmd+= / Cmd+- / Cmd+0)
 *     and never the `close` role (Cmd+W closes the current tab, not the window).
 */

export type MenuRole =
  | 'about'
  | 'services'
  | 'hide'
  | 'hideOthers'
  | 'unhide'
  | 'quit'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pasteAndMatchStyle'
  | 'minimize'
  | 'zoom'
  | 'front'
  | 'togglefullscreen'
  | 'toggleDevTools'
  | 'reload';

export type MenuItemSpec =
  | { type: 'separator' }
  | { type: 'role'; role: MenuRole; label?: string }
  | {
      type: 'command';
      commandId: string;
      label: string;
      /** Electron accelerator string for display (from `toAccelerator`). */
      accelerator?: string;
      enabled?: boolean;
      checked?: boolean;
    }
  | { type: 'submenu'; label: string; role?: 'appMenu' | 'windowMenu' | 'help'; items: MenuItemSpec[] };

export interface MenuSpec {
  items: MenuItemSpec[];
}
