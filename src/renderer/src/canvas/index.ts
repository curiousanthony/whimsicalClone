/**
 * Public API of the canvas engine module. Other modules import ONLY from this file.
 *
 * Editor wiring
 *   createCanvasEditorPlugin(preset)  EditorPlugin for a canvas file kind (shared board format)
 *   canvasCorePlugin                  connector element, select / pan / connector tools, shortcuts
 *
 * Helpers for element definitions (Render / ContextBar)
 *   CanvasText          static rich text, inline TipTap editor while `editing` (commits via setText)
 *   RichTextEditor / RichTextView, richTextToPm / pmToRichText
 *   IconButton, Popover, ColorSwatches, MenuItem, Divider, Icon, iconByName  (chrome primitives)
 *   styleKeyOf          style key used by default / last-used styles ("shape:rectangle")
 *   measureRichText     text measurement (same metrics as CanvasText)
 *
 * Pure utilities (unit tested)
 *   geometry: rects, segments, polylines, rotation, sides
 *   viewport: screen <-> world, zoomAt, fitRect, zoom steps
 *   transform: resizeRect, handles; snapping: snapMovingRect, snapPoint
 *   selection: applyClick, expandGroups, marqueeSelect, nearestInDirection
 *   arrange: z-order, group, align, distribute; clipboard: cloneElements
 *   connectors: getConnectorGeometry, elbowRoute, endpointMarker
 *   pointer: isEraserPointer, normalizePressure (Pointer Events layer)
 *   DocumentController: one-change-per-action commit layer over the host history
 *
 * Contract notes
 *   - Undo / redo is host-owned (SPEC 7). Gestures commit once on pointer-up; Escape cancels.
 *   - Element DOM never receives pointer events, except inside `data-wc-interactive` nodes
 *     and the element being edited (`data-wc-editing`). The engine hit-tests via rbush.
 *   - Tool sessions (ToolDefinition.onPointerDown) run inside a transaction: every
 *     api.update() during the gesture is previewed and committed as ONE undo step on
 *     pointer-up (or discarded on Escape / pointercancel).
 */

import type { BoardDocument, ConnectorElement } from '@renderer/core/types';
import { connectorGeometry, type ConnectorGeometry } from './connectors';
import { boundsResolverFor } from './engine/engine';

export type { CanvasEditorProps } from './CanvasEditor';
export { createCanvasEditorPlugin, type CanvasEditorPluginOptions } from './editorPlugin';
export { canvasCorePlugin } from './plugin';
export { canvasShortcuts } from './shortcuts';

// Text
export { CanvasText, type CanvasTextProps } from './text/CanvasText';
export { RichTextEditor, type RichTextEditorProps } from './text/RichTextEditor';
export { RichTextView } from './text/RichTextView';
export { richTextToPm, pmToRichText, toParagraphsOnly, type PmNode } from './richTextPm';
export { measureRichText, fontSizeFor, LINE_HEIGHT } from './measureText';

// Chrome primitives for element context bars
export { ColorSwatches, Divider, Icon, IconButton, MenuItem, Popover, iconByName, type IconButtonProps } from './components/ui';
export { styleKeyOf } from './engine/commands';

// Pure utilities
export * from './geometry';
export {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEPS,
  clampZoom,
  screenToWorld,
  worldToScreen,
  visibleWorldRect,
  zoomAt,
  panBy,
  stepZoom,
  fitRect,
  centerOn,
} from './viewport';
export { resizeRect, scaleRectWithin, handlesFor, type Handle, type ResizeMode } from './transform';
export { snapMovingRect, snapPoint, snapModeFromModifiers, type SnapGuide, type SnapMode } from './snapping';
export { applyClick, expandGroups, marqueeSelect, nearestInDirection, normalizeSelection, selectAll, selectNextInReadingOrder } from './selection';
export { bringToFront, sendToBack, bringForward, sendBackward, alignOffsets, distributeOffsets, type AlignKind } from './arrange';
export { cloneElements, CLIPBOARD_MIME, type ClipboardPayload } from './clipboard';
export { elbowRoute, endpointMarker, attachmentAt, connectorsAttachedTo, type ConnectorGeometry } from './connectors';
export { isEraserPointer, normalizePressure, toCanvasPointerEvent, ERASER_BUTTONS_BIT } from './pointer';
export { elementBounds, isBoxElement, isConnector, collectMoveSet } from './scene';
export { SceneIndex } from './spatialIndex';
export { DocumentController } from './documentController';

/** Geometry of a connector within a document (path, end points, sides, tangents). */
export function getConnectorGeometry(connector: ConnectorElement, document: BoardDocument): ConnectorGeometry {
  return connectorGeometry(connector, boundsResolverFor(document));
}
