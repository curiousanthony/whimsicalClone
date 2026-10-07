/**
 * Freehand chrome: the contextual bar of selected strokes (pen type + colour, restyle after the
 * fact) and the "Pen options" panel (pen type, colour for new strokes, Detect shapes).
 */

import { useReducer, useSyncExternalStore } from 'react';
import type { Draft } from 'immer';
import { useTranslation } from 'react-i18next';
import { ColorSwatches, Divider, IconButton, MenuItem, Popover } from '@renderer/canvas';
import type {
  BoardDocument,
  CanvasApi,
  CanvasPanelProps,
  ColorRef,
  ContextBarProps,
  StrokeElement,
} from '@renderer/core/types';
import { getDetectShapes, setDetectShapes, subscribeDetectShapes } from './detectShapesPref';
import {
  HIGHLIGHTER_STYLE_KEY,
  MARKER_STYLE_KEY,
  clampColorForTool,
  penStyleFrom,
  restyleFields,
  strokePaint,
  type PenSize,
  type PenTool,
} from './strokeModel';
import { DRAW_TOOL_IDS, SELECT_TOOL_ID, penKindOf, type PenKind } from './toolIds';

interface PenChoice {
  kind: PenKind;
  tool: PenTool;
  size: PenSize;
  icon: string;
  labelKey: 'tools.markerThin' | 'tools.markerThick' | 'tools.highlighter';
  shortcutId?: string;
}

export const PEN_CHOICES: readonly PenChoice[] = [
  {
    kind: 'markerThin',
    tool: 'marker',
    size: 'thin',
    icon: 'Pencil',
    labelKey: 'tools.markerThin',
    shortcutId: 'draw.marker',
  },
  { kind: 'markerThick', tool: 'marker', size: 'thick', icon: 'Brush', labelKey: 'tools.markerThick' },
  {
    kind: 'highlighter',
    tool: 'highlighter',
    size: 'thick',
    icon: 'Highlighter',
    labelKey: 'tools.highlighter',
    shortcutId: 'draw.highlighter',
  },
];

const HIGHLIGHTER_EXCLUDED: readonly ColorRef[] = ['white', 'smoke', 'gray'];

function styleKeyFor(tool: PenTool): string {
  return tool === 'highlighter' ? HIGHLIGHTER_STYLE_KEY : MARKER_STYLE_KEY;
}

/** Restyles stroke elements and remembers the colour so new strokes follow suit. */
function restyleStrokes(
  api: CanvasApi,
  ids: readonly string[],
  patch: { tool?: PenTool; size?: PenSize; color?: ColorRef },
): void {
  const idSet = new Set(ids);
  let target: { tool: PenTool; color: ColorRef } | undefined;
  api.update((d: Draft<BoardDocument>) => {
    for (const el of d.elements) {
      if (el.type !== 'stroke' || !idSet.has(el.id) || el.locked) continue;
      const next = restyleFields(el as StrokeElement, patch);
      Object.assign(el, next);
      target = { tool: next.tool, color: next.color };
    }
  });
  if (target) api.rememberStyle(styleKeyFor(target.tool), { color: target.color });
}

export function StrokeContextBar({ elements, api }: ContextBarProps<StrokeElement>): JSX.Element {
  const { t } = useTranslation('draw');
  const ids = elements.map((e) => e.id);
  const allHighlighter = elements.every((e) => e.tool === 'highlighter');
  const colors = new Set(elements.map((e) => e.color));
  const color: ColorRef | undefined = colors.size === 1 ? elements[0]!.color : undefined;
  const swatch = color
    ? strokePaint(color, api.theme)
    : 'conic-gradient(#9952ec, #2484d4, #26aea0, #e6b725, #d5475b, #9952ec)';
  return (
    <>
      {PEN_CHOICES.map((choice) => {
        const active = elements.every((e) =>
          choice.tool === 'highlighter' ? e.tool === 'highlighter' : e.tool === 'marker' && e.size === choice.size,
        );
        return (
          <IconButton
            key={choice.kind}
            icon={choice.icon}
            label={t(choice.labelKey)}
            active={active}
            size="sm"
            tooltipSide="top"
            onClick={() => restyleStrokes(api, ids, { tool: choice.tool, size: choice.size })}
          />
        );
      })}
      <Divider vertical />
      <Popover
        trigger={({ toggle, open }) => (
          <button
            type="button"
            className={`wc-swatch wc-draw-current-color${open ? ' is-active' : ''}`}
            style={{ background: swatch }}
            aria-label={t('contextBar.color')}
            data-tooltip={t('contextBar.color')}
            data-tooltip-side="top"
            onPointerDown={(e) => e.preventDefault()}
            onClick={toggle}
          />
        )}
      >
        {(close) => (
          <div onClick={close}>
            <ColorSwatches
              value={color}
              theme={api.theme}
              role="stroke"
              customColors={api.getDocument().settings.customColors}
              exclude={allHighlighter ? HIGHLIGHTER_EXCLUDED : []}
              onChange={(c) => restyleStrokes(api, ids, { color: c })}
            />
          </div>
        )}
      </Popover>
    </>
  );
}

/** Panel opened by "Pen options" (draw.penOptions). */
export function PenPanel({ api, onClose }: CanvasPanelProps): JSX.Element {
  const { t } = useTranslation('draw');
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const detect = useSyncExternalStore(subscribeDetectShapes, getDetectShapes, getDetectShapes);
  const activeKind = penKindOf(api.getActiveTool()) ?? 'markerThin';
  const choice = PEN_CHOICES.find((c) => c.kind === activeKind) ?? PEN_CHOICES[0]!;
  const style = penStyleFrom(choice.tool, choice.size, (key) => api.getStyleFor(key));
  const pickTool = (c: PenChoice) => {
    api.setActiveTool(DRAW_TOOL_IDS[c.kind]);
    bump();
  };
  return (
    <div className="wc-panel wc-draw-panel" role="dialog" aria-label={t('panel.title')}>
      <div className="wc-draw-panel__row">
        {PEN_CHOICES.map((c) => (
          <IconButton
            key={c.kind}
            icon={c.icon}
            label={t(c.labelKey)}
            shortcutId={c.shortcutId}
            active={c.kind === activeKind}
            tooltipSide="top"
            onClick={() => pickTool(c)}
          />
        ))}
        <IconButton
          icon="Eraser"
          label={t('tools.eraser')}
          shortcutId="draw.eraser"
          active={api.getActiveTool() === DRAW_TOOL_IDS.eraser}
          tooltipSide="top"
          onClick={() => {
            api.setActiveTool(DRAW_TOOL_IDS.eraser);
            onClose();
          }}
        />
        <IconButton
          icon="MousePointer2"
          label={t('commands.selector')}
          shortcutId="draw.selector"
          active={api.getActiveTool() === SELECT_TOOL_ID}
          tooltipSide="top"
          onClick={() => {
            api.setActiveTool(SELECT_TOOL_ID);
            onClose();
          }}
        />
      </div>
      <div className="wc-draw-panel__label">{t('panel.color')}</div>
      <ColorSwatches
        value={style.color}
        theme={api.theme}
        role="stroke"
        customColors={api.getDocument().settings.customColors}
        exclude={choice.tool === 'highlighter' ? HIGHLIGHTER_EXCLUDED : []}
        onChange={(c) => {
          api.rememberStyle(styleKeyFor(choice.tool), { color: clampColorForTool(choice.tool, c) });
          bump();
        }}
      />
      <Divider />
      <MenuItem
        icon="WandSparkles"
        label={t('commands.detectShapes')}
        active={detect}
        onClick={() => setDetectShapes(api.services.api, !detect)}
      />
    </div>
  );
}
