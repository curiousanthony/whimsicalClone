/**
 * Factory for the EditorPlugin of a canvas file kind (owner: canvas module). Every canvas
 * kind shares the board JSON format and the CanvasEditor; only the preset differs.
 */

import { createElement, lazy } from 'react';
import { getFileKindInfo, type CanvasKind } from '@shared/fileKinds';
import { createEmptyBoard, parseBoard, serializeBoard } from '@renderer/core/boardFormat';
import type { BoardDocument, BoardElement, CanvasPreset, EditorPlugin, EditorProps } from '@renderer/core/types';

const LazyCanvasEditor = lazy(() => import('./CanvasEditor'));

export interface CanvasEditorPluginOptions {
  preset: CanvasPreset;
  /** Elements of a brand-new file (e.g. a mind-map root node). */
  seedElements?: () => BoardElement[];
}

export function createCanvasEditorPlugin(options: CanvasEditorPluginOptions): EditorPlugin<BoardDocument> {
  const { preset } = options;
  const kind: CanvasKind = preset.kind;
  const info = getFileKindInfo(kind);
  function CanvasKindEditor(props: EditorProps<BoardDocument>) {
    return createElement(LazyCanvasEditor, { ...props, preset });
  }
  CanvasKindEditor.displayName = `CanvasEditor(${kind})`;
  return {
    kind,
    extensions: [info.extension],
    labelKey: `common:${info.labelKey}`,
    newFileNameKey: `common:newFile.${kind}`,
    icon: info.icon,
    historyMode: 'host',
    createEmpty: () => createEmptyBoard(kind, options.seedElements?.() ?? []),
    parse: (text) => parseBoard(text, kind),
    serialize: serializeBoard,
    // Canvas shortcut tables are contributed by CanvasPlugins (registered once by the app).
    shortcuts: [],
    component: CanvasKindEditor,
  };
}
