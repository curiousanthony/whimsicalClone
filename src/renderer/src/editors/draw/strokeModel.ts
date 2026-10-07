/**
 * Pure stroke element model: creation from samples, restyling, shape application, colour rules
 * and normalisation. No DOM, no React.
 */

import { DEFAULT_COLORS, HIGHLIGHTER_COLORS, isPaletteColor, resolveColor } from '@renderer/core/palette';
import type { ColorRef, StrokeElement, ThemeMode } from '@renderer/core/types';
import type { DetectResult } from './shapeDetect';
import { buildStrokeBox, reboxForStyle, strokeWidth, thinSamples, worldPoints, type Sample } from './strokeGeometry';

export type PenTool = StrokeElement['tool'];
export type PenSize = StrokeElement['size'];

export interface PenStyle {
  tool: PenTool;
  size: PenSize;
  color: ColorRef;
}

/** Default colour of the highlighter (research: marker is slate by default, highlighter yellow). */
export const DEFAULT_HIGHLIGHTER_COLOR: ColorRef = 'yellow';

/** Style-key under which each pen remembers its last colour (board `lastUsedStyles`). */
export const MARKER_STYLE_KEY = 'stroke';
export const HIGHLIGHTER_STYLE_KEY = 'stroke:highlighter';

export function isHighlighterColor(color: ColorRef): boolean {
  return !isPaletteColor(color) || (HIGHLIGHTER_COLORS as readonly ColorRef[]).includes(color);
}

/** Highlighter palette = theme palette minus white / smoke / gray. */
export function clampColorForTool(tool: PenTool, color: ColorRef): ColorRef {
  if (tool === 'highlighter' && !isHighlighterColor(color)) return DEFAULT_HIGHLIGHTER_COLOR;
  return color;
}

function isColorRef(value: unknown): value is ColorRef {
  return typeof value === 'string' && (isPaletteColor(value as ColorRef) || /^#[0-9a-fA-F]{6}$/.test(value));
}

/** Resolves the style for a new stroke from the board's remembered styles. */
export function penStyleFrom(
  tool: PenTool,
  size: PenSize,
  remember: (key: string) => Record<string, unknown> | undefined,
): PenStyle {
  const key = tool === 'highlighter' ? HIGHLIGHTER_STYLE_KEY : MARKER_STYLE_KEY;
  const remembered = remember(key)?.color;
  const fallback: ColorRef = tool === 'highlighter' ? DEFAULT_HIGHLIGHTER_COLOR : DEFAULT_COLORS.stroke;
  const color = isColorRef(remembered) ? remembered : fallback;
  return { tool, size: tool === 'highlighter' ? 'thick' : size, color: clampColorForTool(tool, color) };
}

/** Colour used to paint a stroke: slate / white swap ink for dark canvases. */
export function strokePaint(color: ColorRef, theme: ThemeMode): string {
  if (theme === 'dark') {
    if (color === 'slate') return '#e5ebf1';
    if (color === 'white') return '#ffffff';
  }
  return resolveColor(color, 'stroke', theme);
}

/** Builds a new stroke element from world-space samples. */
export function createStroke(
  id: string,
  samples: readonly Sample[],
  style: PenStyle,
  options: { isPen?: boolean; minDistance?: number } = {},
): StrokeElement {
  const kept = thinSamples(samples, options.minDistance ?? 0);
  const box = buildStrokeBox(kept, strokeWidth(style));
  const el: StrokeElement = {
    id,
    type: 'stroke',
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    tool: style.tool,
    size: style.size,
    color: style.color,
    points: box.points,
  };
  if (options.isPen) el.isPen = true;
  return el;
}

/** Fields to assign when the pen type and / or colour of a stroke changes. */
export function restyleFields(
  el: Pick<StrokeElement, 'x' | 'y' | 'points' | 'tool' | 'size' | 'color'>,
  patch: Partial<PenStyle>,
): Pick<StrokeElement, 'x' | 'y' | 'w' | 'h' | 'points' | 'tool' | 'size' | 'color'> {
  const tool = patch.tool ?? el.tool;
  const size: PenSize =
    tool === 'highlighter' ? 'thick' : (patch.size ?? (el.tool === 'highlighter' ? 'thin' : el.size));
  const color = clampColorForTool(tool, patch.color ?? el.color);
  const box = reboxForStyle(el, { tool, size });
  return { ...box, tool, size, color };
}

/** Replaces the centre line with an idealised shape (separate undo step; raw stroke is lost only after redo). */
export function shapeFields(
  el: Pick<StrokeElement, 'tool' | 'size'>,
  detected: DetectResult,
): Pick<StrokeElement, 'x' | 'y' | 'w' | 'h' | 'points' | 'detectedShape'> {
  const samples: Sample[] = detected.points.map((p) => ({ x: p.x, y: p.y, pressure: 0.5 }));
  const box = buildStrokeBox(samples, strokeWidth(el));
  return { ...box, detectedShape: detected.shape };
}

/** World-space centre line (for detection input). */
export function strokeCenterLine(el: Pick<StrokeElement, 'x' | 'y' | 'points'>): Array<{ x: number; y: number }> {
  return worldPoints(el);
}

/** Pure normalisation applied on load: fills missing / invalid fields. */
export function normalizeStroke(el: StrokeElement): StrokeElement {
  const tool: PenTool = el.tool === 'highlighter' ? 'highlighter' : 'marker';
  const size: PenSize = el.size === 'thick' ? 'thick' : 'thin';
  const color: ColorRef = isColorRef(el.color)
    ? el.color
    : tool === 'highlighter'
      ? DEFAULT_HIGHLIGHTER_COLOR
      : DEFAULT_COLORS.stroke;
  const points = Array.isArray(el.points) ? el.points.filter((n) => Number.isFinite(n)) : [];
  const valid = points.length - (points.length % 3);
  if (
    tool === el.tool &&
    size === el.size &&
    color === el.color &&
    points.length === el.points?.length &&
    valid === points.length
  )
    return el;
  return { ...el, tool, size, color, points: points.slice(0, valid) };
}
