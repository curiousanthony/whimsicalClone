/**
 * World layer: a div transformed by the viewport (translate + scale) holding every visible
 * element in z-order. Box elements are absolutely positioned wrappers (Render draws in local
 * coordinates); world elements (connectors) render into their own overflow-visible SVG so
 * z-order interleaving is preserved. Offscreen elements are culled through the spatial index.
 */

import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import type { BoardDocument, BoardElement, CanvasApi, CanvasMode, ElementDefinition, ThemeMode } from '@renderer/core/types';
import { expandRect } from '../geometry';
import { isBoxElement } from '../scene';
import { visibleWorldRect } from '../viewport';
import type { CanvasEngine } from '../engine/engine';

interface ElementViewProps {
  element: BoardElement;
  definition: ElementDefinition | undefined;
  document: BoardDocument;
  selected: boolean;
  editing: boolean;
  hovered: boolean;
  zoom: number;
  theme: ThemeMode;
  mode: CanvasMode;
  api: CanvasApi;
}

function UnknownElement({ element }: { element: BoardElement }): JSX.Element {
  const { t } = useTranslation('canvas');
  return <div className="wc-unknown-element">{t('unknownElement', { type: element.type })}</div>;
}

const ElementView = memo(
  function ElementView({ element, definition, document, selected, editing, hovered, zoom, theme, mode, api }: ElementViewProps) {
    if (definition?.layer === 'world') {
      const Render = definition.Render;
      return (
        <svg className="wc-world-el" data-element-id={element.id} width={1} height={1}>
          <Render element={element} document={document} selected={selected} editing={editing} hovered={hovered} zoom={zoom} theme={theme} mode={mode} api={api} />
        </svg>
      );
    }
    if (!isBoxElement(element)) return null;
    const rotation = element.rotation ?? 0;
    const Render = definition?.Render;
    return (
      <div
        className={`wc-box-el${editing ? ' is-editing' : ''}`}
        data-element-id={element.id}
        data-type={element.type}
        style={{
          left: element.x,
          top: element.y,
          width: element.w,
          height: element.h,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
        }}
      >
        {Render ? (
          <Render element={element} document={document} selected={selected} editing={editing} hovered={hovered} zoom={zoom} theme={theme} mode={mode} api={api} />
        ) : (
          <UnknownElement element={element} />
        )}
      </div>
    );
  },
  (a, b) =>
    a.element === b.element &&
    a.selected === b.selected &&
    a.editing === b.editing &&
    a.hovered === b.hovered &&
    a.zoom === b.zoom &&
    a.theme === b.theme &&
    a.mode === b.mode &&
    a.definition === b.definition &&
    // Box elements only re-render when their own data changes; world elements (connectors)
    // depend on other elements' positions.
    (a.definition?.layer !== 'world' || a.document === b.document),
);

export function WorldLayer({ engine }: { engine: CanvasEngine }): JSX.Element {
  const doc = useStore(engine.store, (s) => s.doc);
  const viewport = useStore(engine.store, (s) => s.viewport);
  const size = useStore(engine.store, (s) => s.size);
  const selection = useStore(engine.store, (s) => s.selection);
  const editingId = useStore(engine.store, (s) => s.editing?.id);
  const hoveredId = useStore(engine.store, (s) => s.hoveredId);
  const theme = useStore(engine.store, (s) => s.theme);
  const mode = useStore(engine.store, (s) => s.mode);
  const creationRect = useStore(engine.store, (s) => s.creationRect);
  useStore(engine.store, (s) => s.sessionSeq);

  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const index = engine.getIndex();
  // Cull with a generous margin so short pans do not pop elements in.
  const visible = useMemo(() => {
    if (size.w === 0) return undefined;
    const margin = Math.max(size.w, size.h) / viewport.zoom / 2;
    return new Set(index.idsIn(expandRect(visibleWorldRect(viewport, size), margin)));
  }, [index, viewport, size]);

  const plugins = engine.getPlugins();
  const layerProps = { document: doc, viewport, theme, api: engine as CanvasApi };
  const SessionOverlay = engine.getSessionOverlay();

  return (
    <div
      className="wc-world"
      style={{ transform: `scale(${viewport.zoom}) translate(${-viewport.x}px, ${-viewport.y}px)` }}
    >
      {plugins.map((p) => {
        const Below = p.layers?.below;
        return Below ? <Below key={`below-${p.id}`} {...layerProps} /> : null;
      })}
      {doc.elements.map((el) => {
        if (visible && !visible.has(el.id) && !selectedSet.has(el.id) && el.id !== editingId) return null;
        return (
          <ElementView
            key={el.id}
            element={el}
            definition={engine.lookup(el.type)}
            document={doc}
            selected={selectedSet.has(el.id)}
            editing={el.id === editingId}
            hovered={el.id === hoveredId}
            zoom={viewport.zoom}
            theme={theme}
            mode={mode}
            api={engine}
          />
        );
      })}
      {plugins.map((p) => {
        const Above = p.layers?.above;
        return Above ? <Above key={`above-${p.id}`} {...layerProps} /> : null;
      })}
      {creationRect && (
        <div
          className="wc-creation-rect"
          style={{ left: creationRect.x, top: creationRect.y, width: creationRect.w, height: creationRect.h, borderWidth: 1 / viewport.zoom }}
        />
      )}
      {SessionOverlay && <SessionOverlay api={engine} />}
    </div>
  );
}
