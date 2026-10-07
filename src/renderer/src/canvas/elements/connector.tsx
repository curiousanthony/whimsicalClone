/**
 * Connector element (owner: canvas): world-layer SVG path with straight / curved / elbow
 * routing, 13 endpoint styles, optional label and animation; plus the connector tool (C).
 */

import { useTranslation } from 'react-i18next';
import { resolveColor } from '@renderer/core/palette';
import { emptyRichText, isRichTextEmpty } from '@renderer/core/richText';
import type {
  BoardDocument,
  CanvasApi,
  ConnectorElement,
  ConnectorEnd,
  ConnectorRoute,
  ContextBarProps,
  ElementDefinition,
  ElementRenderProps,
  Endpoint,
  ToolDefinition,
} from '@renderer/core/types';
import { attachmentAt, connectorGeometry, endpointMarker, hitTestConnector } from '../connectors';
import { boundsOfPoints, distance, pointAlongPolyline } from '../geometry';
import { measureRichText } from '../measureText';
import { CanvasEngine, boundsResolverFor } from '../engine/engine';
import { CanvasText } from '../text/CanvasText';
import { ColorSwatches, Divider, IconButton, MenuItem, Popover } from '../components/ui';

export const ENDPOINTS: readonly Endpoint[] = [
  'none',
  'arrow',
  'arrowOpen',
  'triangle',
  'triangleOutline',
  'circle',
  'circleOutline',
  'diamond',
  'diamondOutline',
  'erdOne',
  'erdMany',
  'erdOneOrMany',
  'erdZeroOrMany',
];

const STROKE_WIDTH = 2;
const MARKER_SIZE = 5;

function Marker({ kind, x, y, angle, color }: { kind: Endpoint; x: number; y: number; angle: number; color: string }): JSX.Element | null {
  const m = endpointMarker(kind, MARKER_SIZE);
  if (!m) return null;
  return (
    <path
      d={m.d}
      transform={`translate(${x} ${y}) rotate(${(angle * 180) / Math.PI})`}
      fill={m.fill ? color : 'var(--wc-canvas-surface)'}
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

function ConnectorRender({ element, document, api, editing, theme, selected, hovered }: ElementRenderProps<ConnectorElement>): JSX.Element {
  const { t } = useTranslation('canvas');
  const g = connectorGeometry(element, boundsResolverFor(document));
  const color = resolveColor(element.color, 'stroke', theme);
  const label = element.label;
  const showLabel = !!label && (!isRichTextEmpty(label.text) || editing);
  const labelPos = label ? pointAlongPolyline(g.points, label.t) : undefined;
  const labelSize = label ? measureRichText(label.text, { textSize: 's' }) : undefined;
  const lw = Math.max(40, (labelSize?.w ?? 0) + 16);
  const lh = Math.max(24, (labelSize?.h ?? 0) + 6);
  return (
    <g className={`wc-connector${element.animated ? ' is-animated' : ''}`}>
      {(selected || hovered) && <path d={g.d} fill="none" stroke="var(--wc-selection)" strokeOpacity={selected ? 0.35 : 0.2} strokeWidth={8} strokeLinecap="round" />}
      <path
        d={g.d}
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={element.dashed || element.animated ? '6 6' : undefined}
        className={element.animated ? 'wc-connector__animated' : undefined}
      />
      <Marker kind={element.startEndpoint} x={g.start.point.x} y={g.start.point.y} angle={g.startAngle} color={color} />
      <Marker kind={element.endEndpoint} x={g.end.point.x} y={g.end.point.y} angle={g.endAngle} color={color} />
      {showLabel && label && labelPos && (
        <foreignObject x={labelPos.x - lw / 2} y={labelPos.y - lh / 2} width={lw} height={lh} style={{ overflow: 'visible' }}>
          <div className={`wc-connector-label${label.background ? ' has-background' : ''}`} style={{ pointerEvents: editing ? 'auto' : 'none' }}>
            <CanvasText
              element={element}
              text={label.text}
              editing={editing}
              api={api}
              textSize="s"
              align="center"
              verticalAlign="middle"
              paragraphsOnly
              placeholder={t('textPlaceholder')}
              color={label.color ? resolveColor(label.color, 'stroke', theme) : undefined}
            />
          </div>
        </foreignObject>
      )}
    </g>
  );
}

function ConnectorContextBar({ elements, api }: ContextBarProps<ConnectorElement>): JSX.Element {
  const { t } = useTranslation('canvas');
  const first = elements[0];
  const ids = new Set(elements.map((e) => e.id));
  const set = (patch: Partial<ConnectorElement>) => {
    api.update(
      (d) => {
        for (const el of d.elements) if (ids.has(el.id) && el.type === 'connector') Object.assign(el, patch);
      },
      { coalesceKey: `style:${[...ids].join(',')}` },
    );
    const style: Record<string, string | boolean> = {};
    for (const [k, v] of Object.entries(patch)) if (typeof v === 'string' || typeof v === 'boolean') style[k] = v;
    api.rememberStyle('connector', style);
  };
  const routes: Array<{ route: ConnectorRoute; icon: string; label: string }> = [
    { route: 'straight', icon: 'MoveUpRight', label: t('connector.routeStraight') },
    { route: 'curved', icon: 'Spline', label: t('connector.routeCurved') },
    { route: 'elbow', icon: 'CornerDownRight', label: t('connector.routeElbow') },
  ];
  const endpointMenu = (which: 'startEndpoint' | 'endEndpoint', icon: string, label: string) => (
    <Popover
      trigger={({ toggle, open }) => <IconButton icon={icon} label={label} onClick={toggle} active={open} size="sm" tooltipSide="top" />}
    >
      {(close) => (
        <div className="wc-menu">
          {ENDPOINTS.map((ep) => (
            <MenuItem
              key={ep}
              label={t(`endpoints.${ep}`)}
              active={first?.[which] === ep}
              onClick={() => {
                set({ [which]: ep } as Partial<ConnectorElement>);
                close();
              }}
            />
          ))}
        </div>
      )}
    </Popover>
  );
  return (
    <>
      <Popover
        trigger={({ toggle, open }) => (
          <button type="button" className="wc-color-btn" aria-label={t('contextBar.lineColor')} data-tooltip={t('contextBar.lineColor')} data-tooltip-side="top" onClick={toggle} aria-pressed={open}>
            <span className="wc-color-btn__dot" style={{ background: resolveColor(first?.color ?? 'slate', 'stroke', api.theme) }} />
          </button>
        )}
      >
        {(close) => (
          <ColorSwatches
            value={first?.color}
            theme={api.theme}
            role="stroke"
            customColors={api.getDocument().settings.customColors}
            onChange={(c) => {
              set({ color: c });
              close();
            }}
          />
        )}
      </Popover>
      <Divider vertical />
      {routes.map((r) => (
        <IconButton key={r.route} icon={r.icon} label={r.label} active={first?.route === r.route} onClick={() => set({ route: r.route, waypoints: undefined })} size="sm" tooltipSide="top" />
      ))}
      <Divider vertical />
      <IconButton
        icon="Ellipsis"
        label={first?.dashed ? t('connector.solid') : t('connector.dashed')}
        active={!!first?.dashed}
        onClick={() => set({ dashed: !first?.dashed })}
        size="sm"
        tooltipSide="top"
      />
      {endpointMenu('startEndpoint', 'ArrowLeftToLine', t('connector.startEndpointMenu'))}
      {endpointMenu('endEndpoint', 'ArrowRightToLine', t('connector.endEndpointMenu'))}
      <Divider vertical />
      <IconButton
        icon="Type"
        label={t('connector.addLabel')}
        onClick={() => {
          if (!first) return;
          if (!first.label) {
            api.update((d) => {
              const c = d.elements.find((e) => e.id === first.id);
              if (c && c.type === 'connector') c.label = { text: emptyRichText(), t: 0.5, background: true };
            });
          }
          api.startTextEditing(first.id);
        }}
        size="sm"
        tooltipSide="top"
      />
    </>
  );
}

export const connectorDefinition: ElementDefinition<ConnectorElement> = {
  type: 'connector',
  module: 'canvas',
  layer: 'world',
  Render: ConnectorRender,
  getBounds(element: ConnectorElement, document: BoardDocument) {
    const g = connectorGeometry(element, boundsResolverFor(document));
    const r = boundsOfPoints(g.points) ?? { x: 0, y: 0, w: 0, h: 0 };
    return { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 };
  },
  hitTest(element, world, tolerance, document) {
    const resolver = boundsResolverFor(document);
    if (element.label && !isRichTextEmpty(element.label.text)) {
      const g = connectorGeometry(element, resolver);
      const p = pointAlongPolyline(g.points, element.label.t);
      const size = measureRichText(element.label.text, { textSize: 's' });
      if (Math.abs(world.x - p.x) <= size.w / 2 + 8 && Math.abs(world.y - p.y) <= size.h / 2 + 4) return true;
    }
    return hitTestConnector(element, world, tolerance + 2, resolver);
  },
  resize: 'none',
  rotatable: false,
  connectable: false,
  textEditable: true,
  styleProps: ['color', 'route', 'dashed', 'startEndpoint', 'endEndpoint'],
  getText: (el) => el.label?.text,
  setText(draft, text) {
    if (draft.label) draft.label.text = text;
    else draft.label = { text, t: 0.5, background: true };
  },
  ContextBar: ConnectorContextBar,
  normalize(el) {
    return {
      ...el,
      route: el.route ?? 'elbow',
      color: el.color ?? 'slate',
      dashed: el.dashed ?? false,
      startEndpoint: el.startEndpoint ?? 'none',
      endEndpoint: el.endEndpoint ?? 'arrow',
    };
  },
};

/** Connectable element under a world point (excluding `exclude`). */
function connectableAt(api: CanvasApi, p: { x: number; y: number }, exclude: ReadonlySet<string>): string | undefined {
  if (!(api instanceof CanvasEngine)) return undefined;
  return api.getIndex().hitTest(p, {
    tolerance: 6 / api.getViewport().zoom,
    exclude,
    filter: (id) => {
      const el = api.getElement(id);
      return !!el && el.type !== 'connector' && !!api.getDefinition(el.type)?.connectable;
    },
  });
}

function endAt(api: CanvasApi, p: { x: number; y: number }, exclude: ReadonlySet<string>): { end: ConnectorEnd; target?: string } {
  const target = connectableAt(api, p, exclude);
  if (target && api instanceof CanvasEngine) {
    const rect = api.boundsOf(target)!;
    return { end: attachmentAt(target, rect, p, 10 / api.getViewport().zoom), target };
  }
  const s = api.snapPoint(p);
  return { end: { kind: 'free', x: s.x, y: s.y } };
}

/** Purple target box drawn while dragging over a connectable element (world coordinates). */
function TargetBox({ api, id }: { api: CanvasApi; id: string | undefined }): JSX.Element | null {
  if (!id || !(api instanceof CanvasEngine)) return null;
  const r = api.boundsOf(id);
  if (!r) return null;
  const pad = 4 / api.getViewport().zoom;
  return (
    <div
      className="wc-connect-target"
      style={{ left: r.x - pad, top: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2, borderWidth: 2 / api.getViewport().zoom }}
    />
  );
}

export const connectorTool: ToolDefinition = {
  id: 'canvas.connector',
  module: 'canvas',
  labelKey: 'canvas:toolbar.connector',
  icon: 'MoveUpRight',
  shortcutId: 'canvas.connector',
  group: 'connector',
  modes: ['diagram', 'wireframe'],
  cursor: 'crosshair',
  onPointerDown(e, api) {
    const id = api.createId();
    const startHit = endAt(api, e.world, new Set());
    const style = api.getStyleFor('connector') ?? {};
    const connector: ConnectorElement = {
      id,
      type: 'connector',
      start: startHit.end,
      end: { kind: 'free', x: e.world.x, y: e.world.y },
      route: 'elbow',
      color: 'slate',
      dashed: false,
      startEndpoint: 'none',
      endEndpoint: 'arrow',
      ...(style as Partial<ConnectorElement>),
    };
    api.update((d) => {
      d.elements.push(connector);
    });
    let target: string | undefined;
    const startPoint = e.world;
    let moved = false;
    return {
      onPointerMove(m) {
        if (distance(startPoint, m.world) * api.getViewport().zoom > 6) moved = true;
        const exclude = new Set([id]);
        if (startHit.target) exclude.add(startHit.target);
        const next = endAt(api, m.world, exclude);
        target = next.target;
        api.update((d) => {
          const c = d.elements.find((x) => x.id === id);
          if (c && c.type === 'connector') c.end = next.end;
        });
      },
      onPointerUp() {
        if (!moved) {
          api.update((d) => {
            d.elements = d.elements.filter((x) => x.id !== id);
          });
          return;
        }
        api.setSelection([id]);
      },
      Overlay: ({ api: a }) => <TargetBox api={a} id={target} />,
    };
  },
};

export const selectTool: ToolDefinition = {
  id: 'canvas.selectTool',
  module: 'canvas',
  labelKey: 'canvas:toolbar.select',
  icon: 'MousePointer2',
  shortcutId: 'canvas.selectTool',
  group: 'select',
  modes: ['diagram', 'wireframe'],
  persistent: true,
};

export const panTool: ToolDefinition = {
  id: 'canvas.panTool',
  module: 'canvas',
  labelKey: 'canvas:toolbar.pan',
  icon: 'Hand',
  shortcutId: 'canvas.panTool',
  group: 'select',
  modes: ['diagram', 'wireframe'],
  cursor: 'grab',
  persistent: true,
};
