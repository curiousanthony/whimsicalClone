/**
 * The focused "folder surface" (sidebar tree or a folder view). The folder.* shortcut
 * handlers (scope folderView) are bound once by the shell and act on whichever surface has
 * keyboard focus.
 */

export interface FolderSurface {
  open(): void;
  deleteSelection(): void;
  setView?(view: 'list' | 'grid'): void;
}

let current: FolderSurface | null = null;

export function setFolderSurface(surface: FolderSurface | null): void {
  current = surface;
}

export function clearFolderSurface(surface: FolderSurface): void {
  if (current === surface) current = null;
}

export function folderSurface(): FolderSurface | null {
  return current;
}
