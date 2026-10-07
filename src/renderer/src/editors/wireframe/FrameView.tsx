/**
 * Device frame renderer: flat slate chrome around a white screen, optional status bar and
 * on-screen keyboard. The frame name is shown above the frame and edited in place (Enter).
 */

import type { CSSProperties } from 'react';
import { CanvasText } from '@renderer/canvas';
import type { ElementRenderProps, FrameElement } from '@renderer/core/types';
import { bezelFor, keyboardHeight, specOf, statusBarHeight } from './frames';
import { Glyph } from './draw';
import { frameText } from './model';
import { wirePalette, type WirePalette } from './wirePalette';
import './wireframe.css';

const KEY_ROWS = [10, 9, 7];

function Keyboard({ width, height, p }: { width: number; height: number; p: WirePalette }): JSX.Element {
  const pad = 6;
  const rows = KEY_ROWS.length + 1;
  const rowH = (height - pad * 2) / rows;
  const rects: JSX.Element[] = [];
  KEY_ROWS.forEach((count, r) => {
    const gap = 4;
    const keyW = (width - pad * 2 - gap * (count - 1)) / count;
    const offset = (10 - count) * (keyW + gap) * 0.5;
    for (let i = 0; i < count; i++) {
      rects.push(
        <rect
          key={`${r}:${i}`}
          x={pad + offset + i * (keyW + gap)}
          y={pad + r * rowH + 3}
          width={keyW}
          height={rowH - 8}
          rx={4}
          fill={p.surface}
        />,
      );
    }
  });
  rects.push(
    <rect
      key="space"
      x={width * 0.25}
      y={pad + KEY_ROWS.length * rowH + 3}
      width={width * 0.5}
      height={rowH - 8}
      rx={4}
      fill={p.surface}
    />,
  );
  return (
    <svg width={width} height={height} style={{ display: 'block' }} aria-hidden>
      <rect width={width} height={height} fill={p.line} />
      {rects}
    </svg>
  );
}

function StatusBar({ frame, p, height }: { frame: FrameElement; p: WirePalette; height: number }): JSX.Element {
  const spec = specOf(frame.device);
  const dark: CSSProperties = { color: p.ink };
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height,
        display: 'flex',
        alignItems: spec.cutout === 'island' || spec.cutout === 'notch' ? 'flex-end' : 'center',
        justifyContent: 'space-between',
        padding: spec.cutout ? '0 24px 8px' : '0 16px',
        boxSizing: 'border-box',
        fontSize: 12,
        fontWeight: 700,
        ...dark,
      }}
    >
      <span>9:41</span>
      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <Glyph name="signal" size={14} color={p.ink} />
        <Glyph name="wifi" size={14} color={p.ink} />
        <Glyph name="battery-full" size={16} color={p.ink} />
      </span>
    </div>
  );
}

function Cutout({ frame, p }: { frame: FrameElement; p: WirePalette }): JSX.Element | null {
  const spec = specOf(frame.device);
  if (!spec.cutout || frame.orientation === 'landscape') return null;
  const body = p.chrome;
  if (spec.cutout === 'island')
    return (
      <span
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          width: 96,
          height: 26,
          marginLeft: -48,
          borderRadius: 13,
          background: body,
        }}
      />
    );
  if (spec.cutout === 'notch')
    return (
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          width: 150,
          height: 26,
          marginLeft: -75,
          borderRadius: '0 0 16px 16px',
          background: body,
        }}
      />
    );
  return (
    <span
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        width: 12,
        height: 12,
        marginLeft: -6,
        borderRadius: '50%',
        background: body,
      }}
    />
  );
}

export function FrameRender({ element, theme, api, editing }: ElementRenderProps<FrameElement>): JSX.Element {
  const p = wirePalette(theme);
  const spec = specOf(element.device);
  const bezel = bezelFor(element.device, element.orientation);
  const screenW = Math.max(0, element.w - bezel.left - bezel.right);
  const screenH = Math.max(0, element.h - bezel.top - bezel.bottom);
  const sb = statusBarHeight(element);
  const kb = keyboardHeight(element);
  const screenRadius = Math.max(2, spec.radius - Math.min(bezel.left, bezel.top));
  const isWindow = spec.family === 'desktop';
  const isPlain = spec.family === 'plain';
  const bodyRadius = isPlain ? 4 : spec.radius;

  return (
    <div className="wf-frame">
      <div className={`wf-frame__name${editing ? ' is-editing' : ''}`}>
        <CanvasText
          element={element}
          text={frameText(element)}
          editing={editing}
          api={api}
          textSize="xs"
          scale="board"
          paragraphsOnly
          onEnter={() => {
            api.stopTextEditing();
            return true;
          }}
          color={editing ? 'var(--wc-fg-base)' : undefined}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isPlain ? p.surface : p.chrome,
          border: isPlain ? `2px solid ${p.line}` : undefined,
          borderRadius: bodyRadius,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {isWindow && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: bezel.top,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 12,
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{ width: 10, height: 10, borderRadius: '50%', background: p.surface, opacity: 0.85 }}
              />
            ))}
          </div>
        )}
        {!isPlain && (
          <div
            style={{
              position: 'absolute',
              left: bezel.left,
              top: bezel.top,
              width: screenW,
              height: screenH,
              background: p.surface,
              borderRadius: isWindow ? 0 : screenRadius,
              overflow: 'hidden',
            }}
          >
            {sb > 0 && <StatusBar frame={element} p={p} height={sb} />}
            {kb > 0 && (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: kb }}>
                <Keyboard width={screenW} height={kb} p={p} />
              </div>
            )}
          </div>
        )}
        {isPlain && sb > 0 && <StatusBar frame={element} p={p} height={sb} />}
        {spec.homeButton && element.orientation === 'portrait' && (
          <span
            style={{
              position: 'absolute',
              left: '50%',
              bottom: (bezel.bottom - 36) / 2,
              width: 36,
              height: 36,
              marginLeft: -18,
              borderRadius: '50%',
              border: `2px solid ${p.surface}`,
              opacity: 0.8,
              boxSizing: 'border-box',
            }}
          />
        )}
        <Cutout frame={element} p={p} />
      </div>
    </div>
  );
}
