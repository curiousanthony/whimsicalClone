/**
 * Renderer of a mind-map node (`mindmapNode` element, layer "box").
 *
 * Look: the root is a filled rounded box, first-level nodes are tinted boxes with a coloured
 * outline, deeper nodes are outlined only; branch lines are drawn by BranchLayer.
 * Keyboard while editing (the user's main workflow):
 *   Enter       commit and add a sibling below (a root gets a first child; empty node: stop)
 *   Tab         commit and add a child
 *   Shift+Tab   commit and select the parent
 *   Cmd+Enter   commit and add a sibling above
 *   Shift+Enter soft line break, Esc stop editing (handled by the shared text editor)
 * Hover / selection shows quick-add handles and the collapse button (data-wc-interactive: the
 * only node DOM that receives pointer events; everything else is hit-tested by the engine).
 */

import { useEffect, useMemo, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasText } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { CanvasApi, ElementRenderProps, MindMapNodeElement, Side } from '@renderer/core/types';
import {
  addChild,
  addSibling,
  discardIfEmpty,
  guardedApi,
  hiddenCount,
  isEmptyNode,
  selectParentOf,
  setCollapsedScope,
  sizeOf,
  type CollapseScope,
} from './actions';
import { getMapDisplay } from './display';
import { lucideIcon } from './icons';
import { ICON_SIZE, NODE_METRICS } from './nodeSize';
import {
  DEFAULT_ROOT_COLOR,
  branchSide,
  childIds,
  levelOf,
  orientationOf,
  rootOf,
  validSides,
} from './model';
import { growthDirection } from './navigation';
import { Plus, Minus } from 'lucide-react';
import './mindmap.css';

type HandleDir = 'up' | 'down' | 'left' | 'right';

const SIDE_TO_DIR: Record<Side, HandleDir> = { top: 'up', bottom: 'down', left: 'left', right: 'right' };

function collapseScopeOf(e: ReactMouseEvent): CollapseScope {
  if (e.altKey && e.shiftKey) return 'level';
  if (e.altKey) return 'descendants';
  if (e.shiftKey) return 'siblings';
  return 'self';
}

/** Gives the keyboard back to the canvas after a click on a handle button. */
function refocusCanvas(target: EventTarget): void {
  (target as HTMLElement).closest<HTMLElement>('.wc-canvas')?.focus({ preventScroll: true });
}

interface HandleProps {
  dir: HandleDir;
  slot: number;
  color: string;
  label: string;
  onActivate: (e: ReactMouseEvent) => void;
  className?: string;
  children: React.ReactNode;
}

function Handle({ dir, slot, color, label, onActivate, className, children }: HandleProps): JSX.Element {
  return (
    <button
      type="button"
      data-wc-interactive=""
      data-wc-chrome=""
      className={`wc-mm-handle wc-mm-handle--${dir}${className ? ` ${className}` : ''}`}
      style={{ '--slot': slot, '--mm-color': color } as CSSProperties}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onActivate(e);
        refocusCanvas(e.currentTarget);
      }}
    >
      {children}
    </button>
  );
}

export function MindNodeRender({ element, document, selected, editing, hovered, theme, api }: ElementRenderProps<MindMapNodeElement>): JSX.Element | null {
  const { t } = useTranslation('mindmap');
  const display = getMapDisplay(document, sizeOf);
  const index = display.index;
  const id = element.id;

  // Editing ended on a node left empty: it does not stay on the map.
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing) {
      wasEditing.current = true;
      return;
    }
    if (wasEditing.current) {
      wasEditing.current = false;
      discardIfEmpty(api, id);
    }
  }, [editing, api, id]);

  const editorApi = useMemo(() => guardedApi(api, id), [api, id]);

  if (element.w === 0 && element.h === 0) return null;

  const level = levelOf(element);
  const metrics = NODE_METRICS[level];
  const root = rootOf(index, id);
  const orientation = orientationOf(root);
  const vertical = orientation === 'vertical';
  const side = branchSide(index, id);
  const kids = childIds(index, id);
  const hasChildren = kids.length > 0;
  const color = element.color ?? DEFAULT_ROOT_COLOR;
  const isRoot = level === 'root';
  const stroke = resolveColor(color, 'stroke', theme);
  const background = isRoot ? resolveColor(color, 'fill', theme) : level === 'first' ? resolveColor(color, 'soft', theme) : 'var(--wc-bg-base)';
  const foreground = isRoot ? resolveColor(color, 'onFill', theme) : resolveColor(color, 'text', theme);
  const Icon = element.icon ? lucideIcon(element.icon.name) : undefined;
  const iconLeft = element.icon?.placement !== 'right';

  const boxStyle: CSSProperties = {
    background,
    color: foreground,
    borderRadius: metrics.radius,
    border: isRoot ? 'none' : `${level === 'first' ? 2 : 1.5}px solid ${stroke}`,
    padding: `${metrics.padY - (isRoot ? 0 : level === 'first' ? 2 : 1.5)}px ${metrics.padX - (isRoot ? 0 : level === 'first' ? 2 : 1.5)}px`,
  };

  /* --- keyboard while editing -------------------------------------------------------------- */

  const onEnter = (): boolean => {
    if (isEmptyNode(api, id)) {
      api.stopTextEditing();
      return true;
    }
    addSibling(api, id, 'after');
    return true;
  };
  const onTab = (shift: boolean): boolean => {
    if (shift) selectParentOf(api, id);
    else addChild(api, id);
    return true;
  };
  const onKeyDownCapture = (e: React.KeyboardEvent): void => {
    if (!editing || e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (isEmptyNode(api, id) || element.treeParentId === null) api.stopTextEditing();
      else addSibling(api, id, 'before');
      return;
    }
    if (e.key === 'Backspace' && !e.metaKey && !e.altKey && !e.ctrlKey && element.treeParentId !== null && isEmptyNode(api, id)) {
      e.preventDefault();
      e.stopPropagation();
      api.stopTextEditing();
    }
  };

  /* --- hover handles ----------------------------------------------------------------------- */

  const handles: JSX.Element[] = [];
  const showHandles = !editing && !element.locked;
  if (showHandles) {
    if (isRoot) {
      for (const s of validSides(orientation)) {
        handles.push(
          <Handle
            key={`branch-${s}`}
            dir={SIDE_TO_DIR[s]}
            slot={0}
            color={stroke}
            label={t(`handles.addBranch.${s}`)}
            onActivate={() => addChild(api, id, { side: s })}
          >
            <Plus size={14} strokeWidth={2.25} />
          </Handle>,
        );
      }
    } else if (side) {
      const growth = growthDirection(side);
      let slot = 0;
      if (hasChildren) {
        const collapsed = !!element.collapsed;
        handles.push(
          <Handle
            key="collapse"
            dir={growth}
            slot={slot}
            color={stroke}
            className={collapsed ? 'is-count' : 'is-collapse'}
            label={collapsed ? t('tooltips.expandHint') : t('tooltips.collapseHint')}
            onActivate={(e) => setCollapsedScope(api, id, collapseScopeOf(e), !collapsed)}
          >
            {collapsed ? <span className="wc-mm-count">{hiddenCount(index, id)}</span> : <Minus size={12} strokeWidth={2.5} />}
          </Handle>,
        );
        slot += 1;
      }
      handles.push(
        <Handle key="child" dir={growth} slot={slot} color={stroke} label={t('handles.addChild')} onActivate={() => addChild(api, id)}>
          <Plus size={14} strokeWidth={2.25} />
        </Handle>,
      );
      handles.push(
        <Handle key="sibling" dir={vertical ? 'right' : 'down'} slot={0} color={stroke} label={t('handles.addSibling')} onActivate={() => addSibling(api, id, 'after')}>
          <Plus size={14} strokeWidth={2.25} />
        </Handle>,
      );
    }
  }

  const iconNode = Icon ? (
    <span className="wc-mm-icon" style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Icon size={ICON_SIZE} strokeWidth={1.75} aria-hidden />
    </span>
  ) : null;

  return (
    <div
      className={`wc-mm-node wc-mm-node--${level}${selected ? ' is-selected' : ''}${hovered ? ' is-hovered' : ''}${editing ? ' is-editing' : ''}`}
      data-mm-id={id}
    >
      <div className="wc-mm-box" style={boxStyle} onKeyDownCapture={onKeyDownCapture}>
        {iconLeft && iconNode}
        <div className="wc-mm-text">
          <CanvasText
            element={element}
            text={element.text}
            editing={editing}
            api={editorApi as CanvasApi}
            textSize={element.textSize}
            align={isRoot ? 'center' : 'left'}
            verticalAlign="middle"
            color={foreground}
            bold={metrics.bold}
            paragraphsOnly
            placeholder={isRoot ? t('placeholders.root') : undefined}
            onEnter={onEnter}
            onTab={onTab}
          />
        </div>
        {!iconLeft && iconNode}
      </div>
      {handles}
    </div>
  );
}
