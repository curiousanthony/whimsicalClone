/**
 * Rendering of a diagram shape (owner: flowchart): SVG outline in local coordinates, optional
 * lucide icon and the shared CanvasText for the label. Also used for the shapes-menu tiles.
 */

import { useMemo } from 'react';
import { CanvasText, iconByName } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { ColorRef, ElementRenderProps, FillStyle, ShapeElement, ShapeKind, ThemeMode } from '@renderer/core/types';
import { SHAPE_SPECS, contentLayout, kebabToPascal } from './shapes';
import { shapeGeometry } from './shapeGeometry';

export const STROKE_WIDTH = 2;
const DASH = '7 5';

export interface ShapePaint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash?: string;
  /** Colour of detail strokes drawn on the shape (cylinder rim, actor limbs). */
  detail: string;
  /** Colour of the text drawn on the shape. */
  text: string;
}

/** Colours and stroke for a style (shared by the element and the menu tiles). */
export function shapePaint(kind: ShapeKind, color: ColorRef, fillStyle: FillStyle, theme: ThemeMode, dashed?: boolean): ShapePaint {
  const stroke = resolveColor(color, 'stroke', theme);
  const text = resolveColor(color, 'text', theme);
  if (kind === 'line' || kind === 'bracket') {
    return { fill: 'none', stroke, strokeWidth: STROKE_WIDTH, dash: dashed || fillStyle === 'dashed' ? DASH : undefined, detail: stroke, text };
  }
  if (kind === 'actor') {
    return { fill: fillStyle === 'fill' ? resolveColor(color, 'fill', theme) : 'none', stroke, strokeWidth: STROKE_WIDTH, detail: stroke, text };
  }
  switch (fillStyle) {
    case 'fill':
      return {
        fill: resolveColor(color, 'fill', theme),
        stroke: 'none',
        strokeWidth: 0,
        detail: 'rgba(0,0,0,0.22)',
        text: resolveColor(color, 'onFill', theme),
      };
    case 'border':
      return { fill: resolveColor(color, 'soft', theme), stroke, strokeWidth: STROKE_WIDTH, detail: stroke, text };
    case 'dashed':
      return { fill: resolveColor(color, 'soft', theme), stroke, strokeWidth: STROKE_WIDTH, dash: DASH, detail: stroke, text };
    case 'none':
      return { fill: 'none', stroke, strokeWidth: STROKE_WIDTH, detail: stroke, text };
  }
}

/** The shape outline as an <svg> sized w x h (local coordinates). */
export function ShapeSvg({
  kind,
  w,
  h,
  seed,
  paint,
}: {
  kind: ShapeKind;
  w: number;
  h: number;
  seed?: number;
  paint: ShapePaint;
}): JSX.Element {
  const g = useMemo(() => shapeGeometry(kind, w, h, seed), [kind, w, h, seed]);
  const open = !g.closed && kind !== 'actor';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
      <path
        d={g.d}
        fill={open ? 'none' : paint.fill}
        stroke={paint.stroke}
        strokeWidth={paint.strokeWidth}
        strokeDasharray={paint.dash}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {g.details.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={paint.detail} strokeWidth={STROKE_WIDTH} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function ShapeRender({ element, editing, api, theme }: ElementRenderProps<ShapeElement>): JSX.Element {
  const paint = shapePaint(element.kind, element.color, element.fillStyle, theme, element.dashed);
  const layout = useMemo(() => contentLayout(element), [element.kind, element.w, element.h, element.icon, element.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const spec = SHAPE_SPECS[element.kind];
  const showText = spec.hasText || editing;
  const Icon = element.icon ? iconByName(kebabToPascal(element.icon.name)) : undefined;
  // Line / bracket / cross texts (only while editing) sit centred over the shape.
  const textColor = element.kind === 'actor' || !spec.hasText ? resolveColor(element.color, 'text', theme) : paint.text;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ShapeSvg kind={element.kind} w={element.w} h={element.h} seed={element.seed} paint={paint} />
      {Icon && layout.icon && (
        <div
          style={{ position: 'absolute', left: layout.icon.x, top: layout.icon.y, width: layout.icon.w, height: layout.icon.h, color: textColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-hidden
        >
          <Icon size={layout.icon.w} strokeWidth={1.75} />
        </div>
      )}
      {showText && (
        <div style={{ position: 'absolute', left: layout.text.x, top: layout.text.y, width: layout.text.w, height: layout.text.h }}>
          <CanvasText
            element={element}
            text={element.text}
            editing={editing}
            api={api}
            textSize={element.textSize}
            align={element.textAlign}
            verticalAlign={element.verticalAlign}
            color={textColor}
          />
        </div>
      )}
    </div>
  );
}
