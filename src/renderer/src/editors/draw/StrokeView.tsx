/**
 * Rendering of stroke elements. `StrokeView` draws a committed stroke in its local box;
 * `LiveStrokeOverlay` draws the in-progress buffer of a pen session in world coordinates.
 * `StrokeView` is exported from the module index so other hosts can render strokes too.
 */

import type { CSSProperties } from 'react';
import type { ElementRenderProps, StrokeElement, ThemeMode } from '@renderer/core/types';
import {
  HIGHLIGHTER_OPACITY,
  livePath,
  strokeRender,
  strokeWidth,
  toTuples,
  type Sample,
  type StrokeStyle,
} from './strokeGeometry';
import { strokePaint, type PenStyle } from './strokeModel';

function highlighterStyle(theme: ThemeMode): CSSProperties {
  return { opacity: HIGHLIGHTER_OPACITY, mixBlendMode: theme === 'dark' ? 'screen' : 'multiply' };
}

export interface StrokeViewProps {
  element: StrokeElement;
  theme: ThemeMode;
  /** Dim the stroke (eraser feedback). */
  dimmed?: boolean;
}

/** A committed stroke, drawn in the local coordinates of its element box. */
export function StrokeView({ element, theme, dimmed }: StrokeViewProps): JSX.Element {
  const render = strokeRender(element);
  const paint = strokePaint(element.color, theme);
  const highlighter = element.tool === 'highlighter';
  const width = strokeWidth(element);
  const style: CSSProperties = {
    overflow: 'visible',
    display: 'block',
    pointerEvents: 'none',
    ...(highlighter ? highlighterStyle(theme) : {}),
    ...(dimmed ? { opacity: 0.35 } : {}),
  };
  const first = toTuples(element.points)[0];
  return (
    <svg width={element.w} height={element.h} style={style} aria-hidden data-stroke-tool={element.tool}>
      {render.kind === 'line' ? (
        <path
          d={render.d}
          fill="none"
          stroke={paint}
          strokeWidth={width}
          strokeLinecap={highlighter ? 'butt' : 'round'}
          strokeLinejoin="round"
        />
      ) : render.d ? (
        <path d={render.d} fill={paint} />
      ) : first ? (
        <circle cx={first[0]} cy={first[1]} r={width / 2} fill={paint} />
      ) : null}
    </svg>
  );
}

/** ElementDefinition.Render adapter. */
export function StrokeElementRender({ element, theme }: ElementRenderProps<StrokeElement>): JSX.Element {
  return <StrokeView element={element} theme={theme} />;
}

/** Creates the world-space overlay component of one drawing session. */
export function createLiveStrokeOverlay(
  buffer: readonly Sample[],
  style: PenStyle,
  getTheme: () => ThemeMode,
): () => JSX.Element {
  return function LiveStrokeOverlay(): JSX.Element {
    const theme = getTheme();
    const paint = strokePaint(style.color, theme);
    const d = livePath(buffer, style as StrokeStyle);
    const width = strokeWidth(style);
    const first = buffer[0];
    const highlighter = style.tool === 'highlighter';
    return (
      <svg
        className="wc-world-el"
        width={1}
        height={1}
        style={highlighter ? highlighterStyle(theme) : undefined}
        aria-hidden
      >
        {d ? (
          <path d={d} fill={paint} />
        ) : first ? (
          <circle cx={first.x} cy={first.y} r={width / 2} fill={paint} />
        ) : null}
      </svg>
    );
  };
}
