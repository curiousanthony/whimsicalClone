/**
 * Entries of the "Create new" menu (Whimsical create menu: board, doc, folder; the clone
 * lists each canvas preset). Shared by the sidebar "+", folder rows and context menus.
 */

import { FILE_KINDS } from '@shared/fileKinds';
import type { RelPath } from '@shared/ipc';
import { shortcutRegistry } from '@renderer/core/shortcuts';
import { translateKey } from '@renderer/i18n';
import { fileKindColor, type MenuEntry } from '@renderer/ui';
import { createDocument, createFolder } from './fileActions';

export function createMenuEntries(dir?: RelPath): MenuEntry[] {
  const kinds: MenuEntry[] = FILE_KINDS.map((info) => ({
    type: 'item' as const,
    label: translateKey(`common:${info.labelKey}`),
    icon: info.icon,
    iconColor: fileKindColor(info.kind),
    shortcut: info.kind === 'board' ? shortcutRegistry.format('app.newBoard') : undefined,
    onSelect: () => void createDocument(info.kind, dir),
  }));
  return [
    ...kinds,
    { type: 'separator' },
    {
      type: 'item',
      label: translateKey('common:fileKinds.folder'),
      icon: 'Folder',
      iconColor: fileKindColor('folder'),
      onSelect: () => void createFolder(dir),
    },
  ];
}
