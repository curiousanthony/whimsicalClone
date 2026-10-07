import { extensionOf, type FileKind } from '@shared/fileKinds';
import type { RelPath } from '@shared/ipc';
import type { EditorPlugin } from './types';

export interface EditorRegistry {
  readonly all: readonly EditorPlugin<any>[];
  /** Editor for a file path by extension, or undefined if unsupported. */
  forPath(path: RelPath): EditorPlugin<any> | undefined;
  forKind(kind: FileKind): EditorPlugin<any> | undefined;
}

/** Builds the extension -> editor map. Throws on duplicate extensions or kinds. */
export function createEditorRegistry(plugins: readonly EditorPlugin<any>[]): EditorRegistry {
  const byExt = new Map<string, EditorPlugin<any>>();
  const byKind = new Map<FileKind, EditorPlugin<any>>();
  for (const plugin of plugins) {
    if (byKind.has(plugin.kind)) throw new Error(`Duplicate editor for kind "${plugin.kind}"`);
    byKind.set(plugin.kind, plugin);
    for (const ext of plugin.extensions) {
      const key = ext.toLowerCase();
      if (byExt.has(key)) throw new Error(`Duplicate editor for extension "${ext}"`);
      byExt.set(key, plugin);
    }
  }
  return {
    all: plugins,
    forPath: (path) => byExt.get(extensionOf(path)),
    forKind: (kind) => byKind.get(kind),
  };
}
