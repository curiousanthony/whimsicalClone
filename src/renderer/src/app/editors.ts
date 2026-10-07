/**
 * PRE-WIRED REGISTRIES (owner: architect; frozen). Modules never edit this file: they fill
 * their own `editors/<module>/index.ts` / `plugin.ts`, which are already imported here.
 */

import { createEditorRegistry } from '@renderer/core/editorRegistry';
import type { CanvasPlugin, EditorPlugin, ShortcutDef } from '@renderer/core/types';
import { canvasCorePlugin } from '@renderer/canvas';
import { boardEditor, boardPlugin } from '@renderer/editors/board';
import { docsEditor } from '@renderer/editors/docs';
import { drawEditor, drawPlugin } from '@renderer/editors/draw';
import { flowchartEditor, flowchartPlugin } from '@renderer/editors/flowchart';
import { mindmapEditor, mindmapPlugin } from '@renderer/editors/mindmap';
import { wireframeEditor, wireframePlugin } from '@renderer/editors/wireframe';
import { shellShortcuts } from '@renderer/shell/shortcuts';

/** File extension -> editor. */
export const editorRegistry = createEditorRegistry([
  boardEditor,
  flowchartEditor,
  mindmapEditor,
  wireframeEditor,
  drawEditor,
  docsEditor,
] as EditorPlugin<any>[]);

/** Every canvas file loads every plugin, so all object types can live on any board. */
export const canvasPlugins: readonly CanvasPlugin[] = [
  canvasCorePlugin,
  flowchartPlugin,
  boardPlugin,
  wireframePlugin,
  drawPlugin,
  mindmapPlugin,
];

/** All static shortcut tables, registered once at startup. */
export const allShortcutDefs: readonly ShortcutDef[] = [
  ...shellShortcuts,
  ...editorRegistry.all.flatMap((e) => e.shortcuts),
  ...canvasPlugins.flatMap((p) => p.shortcuts),
];
