/**
 * File / folder icon as shown in the sidebar, tabs and menus. Colour follows Whimsical's
 * create-menu colours per kind (board purple, doc blue, folder grey); a custom icon/colour
 * from workspace metadata overrides it.
 */

import { getFileKindInfo, type FileKind } from '@shared/fileKinds';
import { resolveColor } from '@renderer/core/palette';
import type { ColorRef } from '@renderer/core/types';
import { Icon } from './Icon';

/** CSS colour of a file kind icon (theme-aware CSS variables). */
export function fileKindColor(kind: FileKind | 'folder' | null | undefined): string {
  switch (kind) {
    case 'doc':
      return 'var(--wc-kind-doc-icon)';
    case 'folder':
    case null:
    case undefined:
      return 'var(--wc-fg-icon)';
    default:
      return `var(--wc-kind-${kind}-icon)`;
  }
}

export function fileKindIcon(kind: FileKind | 'folder' | null | undefined, open = false): string {
  if (kind === 'folder') return open ? 'FolderOpen' : 'Folder';
  if (!kind) return 'File';
  return getFileKindInfo(kind).icon;
}

export interface FileIconProps {
  kind: FileKind | 'folder' | null | undefined;
  open?: boolean;
  size?: number;
  customIcon?: string | undefined;
  customColor?: string | undefined;
  dark?: boolean;
}

export function FileIcon({ kind, open, size = 16, customIcon, customColor, dark = false }: FileIconProps): JSX.Element {
  let color = fileKindColor(kind);
  if (customColor) {
    try {
      color = resolveColor(customColor as ColorRef, 'stroke', dark ? 'dark' : 'light');
    } catch {
      color = customColor;
    }
  }
  return <Icon name={customIcon ?? fileKindIcon(kind, open)} size={size} style={{ color, flexShrink: 0 }} />;
}
