/**
 * Renderers of the 29 wireframe components (one function per `WireComponentKind`), drawn in
 * the element's local box. Flat, grey/white, thick (>= 2 px) lines, accent colour only on
 * actionable items. Text is edited in place through the canvas `CanvasText`.
 */

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasText } from '@renderer/canvas';
import { WIREFRAME_TEXT_SIZE_PX } from '@renderer/core/palette';
import type { CanvasApi, ElementRenderProps, WireComponentKind, WireElement } from '@renderer/core/types';
import { lucideByName } from './icons';
import { LOREM, SINGLE_LINE, TEXTUAL, blockLineWidths, starFill } from './drawModel';
import { ROW_HEIGHT, numberProp, stringArrayProp, stringProp } from './registry';
import { tableCells } from './model';
import { withAlpha, wirePalette, type WirePalette } from './wirePalette';
import './wireframe.css';

const BORDER = 2;

interface Ctx {
  el: WireElement;
  p: WirePalette;
  api: CanvasApi;
  editing: boolean;
  fs: number;
  isDisabled: boolean;
  theme: ElementRenderProps['theme'];
}

export function Glyph({
  name,
  size,
  color,
  fill,
}: {
  name: string | undefined;
  size: number;
  color: string;
  fill?: string;
}): JSX.Element | null {
  const Icon = lucideByName(name);
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={2} color={color} fill={fill ?? 'none'} aria-hidden style={{ flex: 'none' }} />;
}

function Text({
  c,
  align = 'left',
  color,
  bold,
  placeholder,
  vAlign = 'middle',
}: {
  c: Ctx;
  align?: 'left' | 'center' | 'right';
  color?: string;
  bold?: boolean;
  placeholder?: string;
  vAlign?: 'top' | 'middle' | 'bottom';
}): JSX.Element {
  return (
    <CanvasText
      element={c.el}
      text={c.el.text}
      editing={c.editing}
      api={c.api}
      textSize={c.el.textSize}
      scale="wireframe"
      align={align}
      verticalAlign={vAlign}
      color={color ?? c.p.ink}
      bold={bold}
      paragraphsOnly
      placeholder={placeholder}
      onEnter={
        SINGLE_LINE.has(c.el.component)
          ? () => {
              c.api.stopTextEditing();
              return true;
            }
          : undefined
      }
    />
  );
}

const box = (style: CSSProperties = {}): CSSProperties => ({
  position: 'absolute',
  inset: 0,
  boxSizing: 'border-box',
  ...style,
});

/* -------------------------------------------------------------------- basic shapes */

function Rectangle(c: Ctx): JSX.Element {
  const { p, el } = c;
  return (
    <div
      className="wf-fill"
      style={box({
        border: `${BORDER}px solid ${p.line}`,
        background: el.color ? withAlpha(p.accentSoft, 1) : p.surface,
        borderRadius: 4,
        padding: 8,
      })}
    >
      <Text c={c} align="center" />
    </div>
  );
}

function Circle(c: Ctx): JSX.Element {
  const { p, el } = c;
  return (
    <div
      className="wf-fill"
      style={box({
        border: `${BORDER}px solid ${p.line}`,
        background: el.color ? p.accentSoft : p.surface,
        borderRadius: '50%',
        padding: 8,
      })}
    >
      <Text c={c} align="center" />
    </div>
  );
}

function Button(c: Ctx): JSX.Element {
  const { p, el, isDisabled } = c;
  const outline = stringProp(el.props, 'variant', 'solid') === 'outline';
  const icon = stringProp(el.props, 'icon', '');
  const bg = isDisabled ? p.fill : outline ? p.surface : p.accent;
  const fg = isDisabled ? p.muted : outline ? p.accent : p.onAccent;
  const border = isDisabled ? p.line : p.accent;
  return (
    <div
      className="wf-row"
      style={box({
        background: bg,
        border: `${BORDER}px solid ${border}`,
        borderRadius: 6,
        padding: `0 ${el.size === 'S' ? 10 : el.size === 'L' ? 18 : 14}px`,
        justifyContent: 'center',
        gap: 6,
      })}
    >
      {icon && <Glyph name={icon} size={el.size === 'S' ? 14 : 18} color={fg} />}
      <div className="wf-label">
        <Text c={c} align="center" color={fg} bold />
      </div>
    </div>
  );
}

function LinkC(c: Ctx): JSX.Element {
  const { p, isDisabled } = c;
  return (
    <div
      className="wf-row wf-link"
      style={box({ color: isDisabled ? p.muted : p.accent, textDecorationColor: isDisabled ? p.muted : p.accent })}
    >
      <Text c={c} color={isDisabled ? p.muted : p.accent} />
    </div>
  );
}

function Line(c: Ctx): JSX.Element {
  const { p, el } = c;
  const vertical = el.props['direction'] === 'v';
  const color = el.color ? p.accent : p.line;
  const dashed = el.props['dashed'] === true;
  const style: CSSProperties = vertical
    ? {
        position: 'absolute',
        left: '50%',
        top: 0,
        bottom: 0,
        width: 0,
        transform: 'translateX(-50%)',
        borderLeft: `${BORDER}px ${dashed ? 'dashed' : 'solid'} ${color}`,
      }
    : {
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 0,
        transform: 'translateY(-50%)',
        borderTop: `${BORDER}px ${dashed ? 'dashed' : 'solid'} ${color}`,
      };
  return <div style={style} />;
}

function ImageC(c: Ctx): JSX.Element {
  const { p, el } = c;
  const src = stringProp(el.props, 'src', '');
  return (
    <div
      style={box({ background: p.fill, borderRadius: 4, overflow: 'hidden', display: 'grid', placeItems: 'center' })}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Glyph name="image" size={Math.max(16, Math.min(48, Math.min(el.w, el.h) * 0.4))} color={p.muted} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- form controls */

function stateColors(c: Ctx): { border: string; bg: string } {
  const { p, el } = c;
  switch (el.state) {
    case 'focused':
      return { border: p.accent, bg: p.surface };
    case 'error':
      return { border: p.danger, bg: p.surface };
    case 'disabled':
      return { border: p.line, bg: p.fill };
    default:
      return { border: p.line, bg: p.surface };
  }
}

function Input(c: Ctx): JSX.Element {
  const { p, el } = c;
  const { border, bg } = stateColors(c);
  const icon = stringProp(el.props, 'icon', '');
  const placeholder = el.props['placeholder'] !== false;
  return (
    <div
      className="wf-row"
      style={box({ background: bg, border: `${BORDER}px solid ${border}`, borderRadius: 4, padding: '0 10px', gap: 8 })}
    >
      <div className="wf-label wf-grow">
        <Text c={c} color={placeholder || el.state === 'disabled' ? p.muted : p.ink} />
      </div>
      {el.state === 'focused' && <span className="wf-caret" style={{ background: p.ink }} />}
      {icon && <Glyph name={icon} size={el.size === 'S' ? 14 : 18} color={p.muted} />}
    </div>
  );
}

function Textarea(c: Ctx): JSX.Element {
  const { p, el } = c;
  const { border, bg } = stateColors(c);
  const placeholder = el.props['placeholder'] !== false;
  return (
    <div style={box({ background: bg, border: `${BORDER}px solid ${border}`, borderRadius: 4, padding: '8px 10px' })}>
      <Text c={c} vAlign="top" color={placeholder || el.state === 'disabled' ? p.muted : p.ink} />
    </div>
  );
}

function Avatar(c: Ctx): JSX.Element {
  const { p, el } = c;
  const icon = stringProp(el.props, 'icon', 'user');
  return (
    <div style={box({ background: p.fill, borderRadius: '50%', display: 'grid', placeItems: 'center' })}>
      <Glyph name={icon} size={Math.max(10, el.w * 0.55)} color={p.muted} />
    </div>
  );
}

function Checkbox(c: Ctx): JSX.Element {
  const { p, el, isDisabled } = c;
  const checked = el.state === 'checked';
  const size = Math.max(16, Math.min(24, c.fs + 6));
  const fg = isDisabled ? p.muted : p.ink;
  return (
    <div className="wf-row" style={box({ gap: 8 })}>
      <span
        className="wf-check"
        style={{
          width: size,
          height: size,
          border: `${BORDER}px solid ${checked && !isDisabled ? p.accent : p.line}`,
          background: checked ? (isDisabled ? p.fill : p.accent) : p.surface,
          borderRadius: 4,
        }}
      >
        {checked && <Glyph name="check" size={size - 6} color={isDisabled ? p.muted : p.onAccent} />}
      </span>
      <div className="wf-label wf-grow">
        <Text c={c} color={fg} />
      </div>
    </div>
  );
}

function Radio(c: Ctx): JSX.Element {
  const { p, el, isDisabled } = c;
  const selected = el.state === 'selected';
  const size = Math.max(16, Math.min(24, c.fs + 6));
  return (
    <div className="wf-row" style={box({ gap: 8 })}>
      <span
        className="wf-check"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `${BORDER}px solid ${selected && !isDisabled ? p.accent : p.line}`,
          background: isDisabled ? p.fill : p.surface,
        }}
      >
        {selected && (
          <span
            style={{
              width: size - 10,
              height: size - 10,
              borderRadius: '50%',
              background: isDisabled ? p.muted : p.accent,
            }}
          />
        )}
      </span>
      <div className="wf-label wf-grow">
        <Text c={c} color={isDisabled ? p.muted : p.ink} />
      </div>
    </div>
  );
}

function Dropdown(c: Ctx): JSX.Element {
  const { p, el } = c;
  const options = stringArrayProp(el.props, 'options');
  const selected = Math.min(Math.max(0, numberProp(el.props, 'selected', 0)), Math.max(0, options.length - 1));
  const row = ROW_HEIGHT[el.size];
  const open = el.state === 'open';
  const isDisabled = el.state === 'disabled';
  const border = open ? p.accent : p.line;
  return (
    <div style={box({ borderRadius: 4, overflow: 'visible' })}>
      <div
        className="wf-row"
        style={{
          height: row,
          boxSizing: 'border-box',
          background: isDisabled ? p.fill : p.surface,
          border: `${BORDER}px solid ${border}`,
          borderRadius: 4,
          padding: '0 10px',
          gap: 8,
        }}
      >
        <span className="wf-label wf-grow wf-ellipsis" style={{ fontSize: c.fs, color: isDisabled ? p.muted : p.ink }}>
          {options[selected] ?? ''}
        </span>
        <Glyph name={open ? 'chevron-up' : 'chevron-down'} size={16} color={p.muted} />
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: row,
            border: `${BORDER}px solid ${p.accent}`,
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            background: p.surface,
            boxSizing: 'border-box',
          }}
        >
          {options.map((o, i) => (
            <div
              key={i}
              className="wf-row wf-ellipsis"
              style={{
                height: row,
                padding: '0 10px',
                fontSize: c.fs,
                background: i === selected ? p.accentSoft : 'transparent',
                color: p.ink,
              }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle(c: Ctx): JSX.Element {
  const { p, el } = c;
  const on = el.state === 'on' || (el.state === 'disabled' && el.props['on'] === true);
  const dis = el.state === 'disabled';
  const bg = dis ? p.fill : on ? (el.color ? p.accent : p.positive) : p.line;
  const knob = Math.max(8, el.h - 8);
  return (
    <div style={box({ background: bg, borderRadius: el.h })}>
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: on ? el.w - knob - 4 : 4,
          width: knob,
          height: knob,
          borderRadius: '50%',
          background: dis ? p.muted : '#ffffff',
        }}
      />
    </div>
  );
}

function Slider(c: Ctx): JSX.Element {
  const { p, el, isDisabled } = c;
  const v = Math.min(1, Math.max(0, numberProp(el.props, 'value', 0.4)));
  const accent = isDisabled ? p.muted : p.accent;
  const handle = Math.min(el.h, 20);
  const usable = Math.max(1, el.w - handle);
  return (
    <div style={box()}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 4,
          marginTop: -2,
          borderRadius: 2,
          background: p.line,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: handle / 2 + usable * v,
          top: '50%',
          height: 4,
          marginTop: -2,
          borderRadius: 2,
          background: accent,
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: usable * v,
          top: '50%',
          width: handle,
          height: handle,
          marginTop: -handle / 2,
          borderRadius: '50%',
          background: accent,
          border: `3px solid ${p.surface}`,
          boxSizing: 'border-box',
          boxShadow: `0 0 0 ${BORDER}px ${accent}`,
        }}
      />
    </div>
  );
}

function ProgressBar(c: Ctx): JSX.Element {
  const { p, el } = c;
  const v = Math.min(1, Math.max(0, numberProp(el.props, 'value', 0.6)));
  const th = Math.min(el.h, 12);
  return (
    <div style={box()}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: th,
          marginTop: -th / 2,
          borderRadius: th,
          background: p.fill,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${v * 100}%`,
            height: '100%',
            background: el.color ? p.accent : p.positive,
            borderRadius: th,
          }}
        />
      </div>
    </div>
  );
}

function Stars(c: Ctx): JSX.Element {
  const { p, el } = c;
  const value = numberProp(el.props, 'value', 4);
  const size = Math.max(10, Math.min(el.h, el.w / 5 - 2));
  return (
    <div className="wf-row" style={box({ gap: 2 })}>
      {[0, 1, 2, 3, 4].map((i) => {
        const full = starFill(value, i) > 0;
        return (
          <Glyph key={i} name="star" size={size} color={full ? p.accent : p.line} fill={full ? p.accent : 'none'} />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- navigation */

function MobileTabs(c: Ctx): JSX.Element {
  const { p, el } = c;
  const items = stringArrayProp(el.props, 'items');
  const icons = stringArrayProp(el.props, 'icons');
  const active = numberProp(el.props, 'active', 0);
  return (
    <div className="wf-row" style={box({ background: p.surface, borderTop: `${BORDER}px solid ${p.line}` })}>
      {items.map((label, i) => {
        const on = i === active;
        const color = on ? p.accent : p.muted;
        return (
          <div
            key={i}
            className="wf-col wf-grow"
            style={{ alignItems: 'center', justifyContent: 'center', gap: 2, color, height: '100%' }}
          >
            <Glyph name={icons[i] || 'circle'} size={20} color={color} />
            <span className="wf-ellipsis" style={{ fontSize: c.fs, maxWidth: '90%', fontWeight: on ? 700 : 400 }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalTabs(c: Ctx): JSX.Element {
  const { p, el } = c;
  const items = stringArrayProp(el.props, 'items');
  const active = numberProp(el.props, 'active', 0);
  return (
    <div className="wf-row" style={box({ borderBottom: `${BORDER}px solid ${p.line}`, alignItems: 'stretch' })}>
      {items.map((label, i) => {
        const on = i === active;
        return (
          <div
            key={i}
            className="wf-row wf-ellipsis"
            style={{
              padding: '0 16px',
              fontSize: c.fs,
              fontWeight: on ? 700 : 400,
              color: on ? p.accent : p.muted,
              boxShadow: on ? `inset 0 -3px 0 ${p.accent}` : undefined,
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

function VerticalTabs(c: Ctx): JSX.Element {
  const { p, el } = c;
  const items = stringArrayProp(el.props, 'items');
  const active = numberProp(el.props, 'active', 0);
  return (
    <div className="wf-col" style={box({ borderRight: `${BORDER}px solid ${p.line}` })}>
      {items.map((label, i) => {
        const on = i === active;
        return (
          <div
            key={i}
            className="wf-row wf-ellipsis"
            style={{
              height: 40,
              padding: '0 16px',
              fontSize: c.fs,
              fontWeight: on ? 700 : 400,
              color: on ? p.accent : p.muted,
              boxShadow: on ? `inset 3px 0 0 ${p.accent}` : undefined,
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- text blocks */

function LoremIpsum(c: Ctx): JSX.Element {
  const { p } = c;
  return (
    <div style={box({ overflow: 'hidden', fontSize: c.fs, lineHeight: 1.5, color: p.ink, opacity: 0.85 })}>{LOREM}</div>
  );
}

function BlockText(c: Ctx): JSX.Element {
  const { p, el } = c;
  const pitch = c.fs * 1.6;
  const bar = Math.max(4, Math.round(c.fs * 0.7));
  const lines = Math.max(1, Math.floor(el.h / pitch));
  const widths = blockLineWidths(lines);
  return (
    <svg width={el.w} height={el.h} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      {widths.map((f, i) => (
        <rect
          key={i}
          x={0}
          y={i * pitch + (pitch - bar) / 2}
          width={Math.max(8, el.w * f)}
          height={bar}
          rx={bar / 2}
          fill={p.muted}
          opacity={0.55}
        />
      ))}
    </svg>
  );
}

function Heading(c: Ctx): JSX.Element {
  return (
    <div className="wf-row" style={box()}>
      <Text c={c} bold />
    </div>
  );
}

/* -------------------------------------------------------------------- misc */

function Overlay(c: Ctx): JSX.Element {
  const { el, p } = c;
  const base = el.color ? p.accent : '#687c89';
  return <div style={box({ background: withAlpha(base, 0.6), borderRadius: 2 })} />;
}

function TableC(c: Ctx): JSX.Element {
  const { p, el } = c;
  const cells = tableCells(el.props);
  const rows = cells.length;
  const cols = cells[0]?.length ?? 1;
  return (
    <div
      style={box({
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        background: p.surface,
        border: `${BORDER}px solid ${p.line}`,
        borderRadius: 4,
        overflow: 'hidden',
      })}
    >
      {cells.flatMap((row, r) =>
        row.map((text, col) => (
          <div
            key={`${r}:${col}`}
            className="wf-row wf-ellipsis"
            style={{
              padding: '0 8px',
              fontSize: c.fs,
              color: p.ink,
              borderRight: col < cols - 1 ? `${BORDER}px solid ${p.line}` : undefined,
              borderBottom: r < rows - 1 ? `${BORDER}px solid ${p.line}` : undefined,
              fontWeight: r === 0 && el.props['header'] === true ? 700 : 400,
            }}
          >
            {text}
          </div>
        )),
      )}
    </div>
  );
}

function Tooltip(c: Ctx): JSX.Element {
  const { p, el } = c;
  const side = stringProp(el.props, 'pointer', 'bottom');
  const notch = 8;
  const bg = el.color ? p.accent : c.theme === 'dark' ? '#8291a0' : '#50606f';
  const fg = el.color ? p.onAccent : '#ffffff';
  const inset = {
    top: side === 'top' ? notch : 0,
    bottom: side === 'bottom' ? notch : 0,
    left: side === 'left' ? notch : 0,
    right: side === 'right' ? notch : 0,
  };
  const arrow: CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
  };
  if (side === 'bottom')
    Object.assign(arrow, {
      left: '50%',
      bottom: 0,
      marginLeft: -notch,
      borderWidth: `${notch}px ${notch}px 0`,
      borderTopColor: bg,
    });
  if (side === 'top')
    Object.assign(arrow, {
      left: '50%',
      top: 0,
      marginLeft: -notch,
      borderWidth: `0 ${notch}px ${notch}px`,
      borderBottomColor: bg,
    });
  if (side === 'left')
    Object.assign(arrow, {
      top: '50%',
      left: 0,
      marginTop: -notch,
      borderWidth: `${notch}px ${notch}px ${notch}px 0`,
      borderRightColor: bg,
    });
  if (side === 'right')
    Object.assign(arrow, {
      top: '50%',
      right: 0,
      marginTop: -notch,
      borderWidth: `${notch}px 0 ${notch}px ${notch}px`,
      borderLeftColor: bg,
    });
  return (
    <div style={box()}>
      <div style={{ position: 'absolute', ...inset, background: bg, borderRadius: 6, padding: '4px 10px' }}>
        <Text c={c} align="center" color={fg} />
      </div>
      {side !== 'none' && <span style={arrow} />}
    </div>
  );
}

function Video(c: Ctx): JSX.Element {
  const { p, el } = c;
  const r = Math.max(14, Math.min(el.w, el.h) * 0.18);
  return (
    <div style={box({ background: p.fill, borderRadius: 4, display: 'grid', placeItems: 'center' })}>
      <span
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          background: p.muted,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Glyph name="play" size={r} color={p.surface} fill={p.surface} />
      </span>
    </div>
  );
}

function MapC(c: Ctx): JSX.Element {
  const { p } = c;
  return (
    <div style={box({ background: p.fill, borderRadius: 4, overflow: 'hidden' })}>
      <svg width="100%" height="100%" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g stroke={p.surface} strokeWidth="6" fill="none" strokeLinecap="round">
          <path d="M-10 60 L330 120" />
          <path d="M-10 150 L330 90" />
          <path d="M80 -10 L120 210" />
          <path d="M230 -10 L200 210" />
          <path d="M140 80 L330 20" strokeWidth="4" />
        </g>
        <g fill={p.line} opacity="0.7">
          <rect x="20" y="10" width="40" height="30" rx="3" />
          <rect x="240" y="130" width="50" height="40" rx="3" />
          <rect x="130" y="130" width="40" height="30" rx="3" />
        </g>
        <path d="M165 70c0 14-14 24-14 24s-14-10-14-24a14 14 0 0 1 28 0z" fill={p.danger} transform="translate(0 -6)" />
        <circle cx="151" cy="58" r="5" fill={p.surface} />
      </svg>
    </div>
  );
}

function Tag(c: Ctx): JSX.Element {
  const { p, el } = c;
  const bg = el.color ? p.accentSoft : p.line;
  return (
    <div
      className="wf-row"
      style={box({ background: bg, borderRadius: el.h, padding: '0 8px', justifyContent: 'center' })}
    >
      <div className="wf-label">
        <Text c={c} align="center" color={p.ink} />
      </div>
    </div>
  );
}

const RENDERERS: Record<WireComponentKind, (c: Ctx) => JSX.Element> = {
  rectangle: Rectangle,
  circle: Circle,
  button: Button,
  link: LinkC,
  divider: Line,
  line: Line,
  image: ImageC,
  input: Input,
  textarea: Textarea,
  avatar: Avatar,
  checkbox: Checkbox,
  radio: Radio,
  dropdown: Dropdown,
  mobileTabs: MobileTabs,
  horizontalTabs: HorizontalTabs,
  verticalTabs: VerticalTabs,
  loremIpsum: LoremIpsum,
  blockText: BlockText,
  heading: Heading,
  slider: Slider,
  progressBar: ProgressBar,
  overlay: Overlay,
  table: TableC,
  toggle: Toggle,
  tooltip: Tooltip,
  stars: Stars,
  video: Video,
  map: MapC,
  tag: Tag,
};

/** Renders a wire element; components without text leave text editing immediately. */
export function WireRender({ element, theme, api, editing }: ElementRenderProps<WireElement>): ReactNode {
  const { t } = useTranslation('wireframe');
  const textual = TEXTUAL.has(element.component);
  useEffect(() => {
    if (editing && !textual) api.stopTextEditing();
  }, [editing, textual, api]);
  const Draw = RENDERERS[element.component];
  if (!Draw) return <div className="wf-unknown">{t('unknownComponent', { name: String(element.component) })}</div>;
  const p = wirePalette(theme, element.color);
  const fs = WIREFRAME_TEXT_SIZE_PX[element.textSize] ?? 14;
  const isDisabled = element.state === 'disabled';
  const c: Ctx = { el: element, p, api, editing: editing && textual, fs, isDisabled, theme };
  return (
    <div
      className={`wf wf-${element.component}${isDisabled ? ' is-disabled' : ''}`}
      style={{ position: 'absolute', inset: 0, fontFamily: 'var(--wc-font-sans)', color: p.ink }}
    >
      <Draw {...c} />
    </div>
  );
}
