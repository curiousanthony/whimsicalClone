/**
 * One creation tool per shape kind (owner: flowchart). The tool id equals the command id of
 * its shortcut ("flowchart.rectangle"), so the canvas binds the shape keys automatically and
 * "R, Enter" creates a rectangle at the viewport centre and starts editing it.
 */

import type { CanvasApi, Point, Rect, ShapeKind, ToolDefinition } from '@renderer/core/types';
import { SHAPE_KINDS, SHAPE_SPECS, createShape, resolveShapeStyle } from './shapes';

/** Creates a shape through the canvas API and returns its id. */
export function createShapeAt(api: CanvasApi, kind: ShapeKind, at: Point, rect?: Rect): string {
  const id = api.createId();
  const style = resolveShapeStyle(api, kind);
  const shape = createShape({ id, kind, at, rect, style });
  api.update((d) => {
    d.elements.push(shape);
  });
  return id;
}

export function shapeTool(kind: ShapeKind): ToolDefinition {
  const spec = SHAPE_SPECS[kind];
  return {
    id: `flowchart.${kind}`,
    module: 'flowchart',
    labelKey: `flowchart:commands.${kind}`,
    icon: spec.icon,
    shortcutId: `flowchart.${kind}`,
    group: 'shapes',
    modes: ['diagram'],
    keywordsKey: `flowchart:keywords.${kind}`,
    cursor: 'crosshair',
    editAfterCreate: spec.hasText,
    create: (api, at, rect) => [createShapeAt(api, kind, at, rect)],
  };
}

export const shapeTools: ToolDefinition[] = SHAPE_KINDS.map(shapeTool);
