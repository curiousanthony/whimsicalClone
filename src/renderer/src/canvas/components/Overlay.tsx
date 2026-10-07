/**
 * Screen-space interaction overlay: hover outline, selection boxes, resize handles,
 * connector end handles, rotate button, quick-add "+" buttons, marquee, smart guides and the
 * size label shown while resizing.
 */

import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import type { ConnectorElement, Direction, Rect } from '@renderer/core/types';
import { connectorGeometry } from '../connectors';
import { isBoxElement, isConnector } from '../scene';
import { handleCursor, handlePosition, handlesFor, type ResizeMode } from '../transform';
import { worldToScreen } from '../viewport';
import { CanvasEngine, SELECT_TOOL, boundsResolverFor } from '../engine/engine';
import { quickAdd } from '../engine/commands';
import { Icon } from './ui';

function toScreenRect(engine: CanvasEngine, r: Rect): Rect {
  const v = engine.getViewport();
  const p = worldToScreen(v, r);
  return { x: p.x, y: p.y, w: r.w * v.zoom, h: r.h * v.zoom };
}

const QUICK_ADD_DIRS: readonly Direction[] = ['up', 'right', 'down', 'left'];

export function Overlay({ engine }: { engine: CanvasEngine }): JSX.Element {
  const { t } = useTranslation('canvas');
  const doc = useStore(engine.store, (s) => s.doc);
  useStore(engine.store, (s) => s.viewport);
  useStore(engine.store, (s) => s.size);
  const selection = useStore(engine.store, (s) => s.selection);
  const hoveredId = useStore(engine.store, (s) => s.hoveredId);
  const editing = useStore(engine.store, (s) => s.editing);
  const marquee = useStore(engine.store, (s) => s.marquee);
  const guides = useStore(engine.store, (s) => s.guides);
  const resizeLabel = useStore(engine.store, (s) => s.resizeLabel);
  const interacting = useStore(engine.store, (s) => s.interacting);
  const tool = useStore(engine.store, (s) => s.tool);
  const quickAddHidden = useStore(engine.store, (s) => s.quickAddHidden);
  const mode = useStore(engine.store, (s) => s.mode);
  const zoom = engine.getViewport().zoom;

  const selectedEls = doc.elements.filter((e) => selection.includes(e.id));
  const boxes = selectedEls.filter((e) => !isConnector(e));
  const unionWorld = engine.selectionBounds(boxes.map((e) => e.id));
  const union = unionWorld ? toScreenRect(engine, unionWorld) : undefined;
  const single = selectedEls.length === 1 ? selectedEls[0] : undefined;
  const singleDef = single ? engine.lookup(single.type) : undefined;
  const anyLocked = selectedEls.some((e) => e.locked);

  let resizeMode: ResizeMode = 'none';
  if (boxes.length > 0 && !anyLocked && boxes.length === selectedEls.length) {
    if (boxes.length === 1) resizeMode = (singleDef?.resize ?? (single && isBoxElement(single) ? 'free' : 'none')) as ResizeMode;
    else resizeMode = boxes.some((e) => engine.lookup(e.type)?.resize === 'aspect') ? 'aspect' : 'free';
  }
  const handles = tool === SELECT_TOOL && !editing && union ? handlesFor(resizeMode) : [];

  const hover =
    hoveredId && !selection.includes(hoveredId) && !interacting && tool === SELECT_TOOL
      ? doc.elements.find((e) => e.id === hoveredId)
      : undefined;
  const hoverRect = hover && !isConnector(hover) ? engine.boundsOf(hover.id) : undefined;

  const connector = single && isConnector(single) ? (single as ConnectorElement) : undefined;
  const connectorGeo = connector ? connectorGeometry(connector, boundsResolverFor(doc)) : undefined;

  const showQuickAdd =
    !!single && !!singleDef?.quickAdd && !single.locked && !editing && !interacting && !quickAddHidden && mode === 'diagram' && tool === SELECT_TOOL && !!union;

  return (
    <div className="wc-overlay" aria-hidden>
      {hoverRect && <div className="wc-hover-box" style={rectStyle(toScreenRect(engine, hoverRect))} />}

      {boxes.length > 1 &&
        boxes.map((e) => {
          const r = engine.boundsOf(e.id);
          return r ? <div key={e.id} className="wc-selection-item" style={rectStyle(toScreenRect(engine, r))} /> : null;
        })}

      {union && !interacting && (
        <div className={`wc-selection-box${anyLocked ? ' is-locked' : ''}${editing ? ' is-editing' : ''}`} style={rectStyle(union)} />
      )}
      {union && interacting && <div className="wc-selection-box is-moving" style={rectStyle(union)} />}

      {!interacting &&
        handles.map((h) => {
          const p = handlePosition(union!, h);
          return (
            <div
              key={h}
              className={`wc-handle wc-handle--${h.length === 2 ? 'corner' : 'edge'} wc-handle--${h}`}
              data-handle={h}
              style={{ left: p.x, top: p.y, cursor: handleCursor(h) }}
            />
          );
        })}

      {!interacting && single && singleDef?.rotatable && !single.locked && !editing && union && tool === SELECT_TOOL && (
        <button
          type="button"
          className="wc-rotate-btn"
          data-wc-interactive=""
          aria-label={t('handles.rotate')}
          data-tooltip={t('handles.rotate')}
          data-tooltip-side="top"
          style={{ left: union.x + union.w + 14, top: union.y - 14 }}
          onClick={() => {
            engine.update((d) => {
              const el = d.elements.find((x) => x.id === single.id) as { rotation?: 0 | 90 | 180 | 270 } | undefined;
              if (el) el.rotation = (((el.rotation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270;
            });
          }}
        >
          <Icon name="RotateCw" size={14} />
        </button>
      )}

      {connectorGeo && !interacting && !connector?.locked && (
        <>
          {(['start', 'end'] as const).map((which) => {
            const p = worldToScreen(engine.getViewport(), which === 'start' ? connectorGeo.start.point : connectorGeo.end.point);
            return <div key={which} className="wc-handle wc-handle--endpoint" data-handle={which} style={{ left: p.x, top: p.y }} />;
          })}
        </>
      )}

      {showQuickAdd &&
        QUICK_ADD_DIRS.map((d) => {
          const offset = 22;
          const pos =
            d === 'up'
              ? { left: union!.x + union!.w / 2, top: union!.y - offset }
              : d === 'down'
                ? { left: union!.x + union!.w / 2, top: union!.y + union!.h + offset }
                : d === 'left'
                  ? { left: union!.x - offset, top: union!.y + union!.h / 2 }
                  : { left: union!.x + union!.w + offset, top: union!.y + union!.h / 2 };
          return (
            <button
              key={d}
              type="button"
              className="wc-quick-add"
              data-wc-interactive=""
              aria-label={t(`quickAdd.${d}`)}
              style={pos}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => quickAdd(engine, d)}
            >
              <Icon name="Plus" size={12} />
            </button>
          );
        })}

      {marquee && <div className="wc-marquee" style={rectStyle(toScreenRect(engine, marquee))} />}

      {guides.map((g, i) => {
        const v = engine.getViewport();
        if (g.axis === 'x') {
          const a = worldToScreen(v, { x: g.at, y: g.from });
          return <div key={i} className="wc-guide wc-guide--x" style={{ left: a.x, top: a.y, height: (g.to - g.from) * zoom }} />;
        }
        const a = worldToScreen(v, { x: g.from, y: g.at });
        return <div key={i} className="wc-guide wc-guide--y" style={{ left: a.x, top: a.y, width: (g.to - g.from) * zoom }} />;
      })}

      {resizeLabel && union && (
        <div className="wc-size-label" style={{ left: union.x + union.w / 2, top: union.y + union.h + 10 }}>
          {t('sizeLabel', { w: resizeLabel.w, h: resizeLabel.h })}
        </div>
      )}
    </div>
  );
}

function rectStyle(r: Rect): React.CSSProperties {
  return { left: r.x, top: r.y, width: r.w, height: r.h };
}
