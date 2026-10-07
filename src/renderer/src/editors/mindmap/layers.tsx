/**
 * World layers of the mind-map module.
 *
 *   BranchLayer   (below all elements) the curved / elbow lines between nodes
 *   EffectsLayer  (above) drop placeholder while a node is dragged, load-time layout repair,
 *                 and the "pointer gesture running" flag that pauses the reflow animation
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { resolveColor } from '@renderer/core/palette';
import type { CanvasLayerProps, ColorRef, Rect } from '@renderer/core/types';
import { relayoutNow, sizeOf } from './actions';
import { computeBranches, type Branch } from './branches';
import { DRAG_SLOP } from './afterChange';
import { getMapDisplay } from './display';
import { computeDropTarget, type DropTarget } from './drop';
import { isMindNode, orientationOf, rootOf } from './model';

function BranchPath({ branch }: { branch: Branch }): JSX.Element {
  const ref = useRef<SVGPathElement>(null);
  // CSS `d` lets the browser morph the path in step with the nodes' left/top transitions.
  useLayoutEffect(() => {
    ref.current?.style.setProperty('d', `path("${branch.d}")`);
  }, [branch.d]);
  return (
    <path
      ref={ref}
      className="wc-mm-branch"
      d={branch.d}
      stroke={branch.color ?? 'currentColor'}
      strokeWidth={branch.level === 'first' ? 3 : 2}
    />
  );
}

export function BranchLayer({ document, theme }: CanvasLayerProps): JSX.Element | null {
  const display = getMapDisplay(document, sizeOf);
  const branches = useMemo(
    () =>
      computeBranches(
        display.index,
        (node) => (node.color ? resolveColor(node.color as ColorRef, 'stroke', theme) : undefined),
        (id) => display.follow.get(id),
      ),
    [display, theme],
  );
  if (branches.length === 0) return null;
  return (
    <svg className="wc-mm-branches" width={1} height={1} aria-hidden>
      {branches.map((b) => (
        <BranchPath key={b.id} branch={b} />
      ))}
    </svg>
  );
}

interface Placeholder {
  id: string;
  target: DropTarget;
  ref: Rect;
  vertical: boolean;
}

function DropPlaceholders({ document }: { document: CanvasLayerProps['document'] }): JSX.Element | null {
  const display = getMapDisplay(document, sizeOf);
  const placeholders = useMemo<Placeholder[]>(() => {
    const out: Placeholder[] = [];
    for (const [id, rest] of display.dragged) {
      const node = display.index.nodes.get(id);
      if (!node) continue;
      const centre = { x: node.x + node.w / 2, y: node.y + node.h / 2 };
      if (Math.hypot(node.x - rest.x, node.y - rest.y) < DRAG_SLOP) continue;
      const rectOf = (nid: string): Rect | undefined => {
        const n = display.index.nodes.get(nid);
        return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : undefined;
      };
      const target = computeDropTarget(display.index, id, centre, rectOf);
      const ref = target && rectOf(target.refId);
      if (!target || !ref) continue;
      out.push({ id, target, ref, vertical: orientationOf(rootOf(display.index, id)) === 'vertical' });
    }
    return out;
  }, [display]);
  if (placeholders.length === 0) return null;
  return (
    <svg className="wc-mm-branches" width={1} height={1} aria-hidden>
      {placeholders.map(({ id, target, ref, vertical }) => {
        if (target.kind === 'child' || (target.kind === 'rootChild' && !target.where)) {
          return <rect key={id} className="wc-mm-drop-target" x={ref.x - 5} y={ref.y - 5} width={ref.w + 10} height={ref.h + 10} rx={12} />;
        }
        const before = target.where === 'before';
        if (vertical) {
          const x = before ? ref.x - 8 : ref.x + ref.w + 8;
          return <line key={id} className="wc-mm-drop-slot" x1={x} x2={x} y1={ref.y} y2={ref.y + ref.h} />;
        }
        const y = before ? ref.y - 8 : ref.y + ref.h + 8;
        return <line key={id} className="wc-mm-drop-slot" x1={ref.x} x2={ref.x + ref.w} y1={y} y2={y} />;
      })}
    </svg>
  );
}

/** Pauses the reflow animation while a pointer gesture runs; re-enables it right after release. */
function useGestureFlag(): void {
  useEffect(() => {
    const root = window.document.documentElement;
    let frame = 0;
    const down = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      root.setAttribute('data-wc-mm-gesture', '');
    };
    const up = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.removeAttribute('data-wc-mm-gesture');
      });
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (frame) cancelAnimationFrame(frame);
      root.removeAttribute('data-wc-mm-gesture');
    };
  }, []);
}

/**
 * Live follow while the ROOT is dragged: the canvas only moves the root element (and re-renders
 * only that one), so the descendants are shifted here, straight on their DOM boxes, by the same
 * offset the branch lines use. Cleared as soon as the document is normalised (pointer-up).
 */
function useFollowOffsets(document: CanvasLayerProps['document']): void {
  const applied = useRef(new Set<string>());
  useLayoutEffect(() => {
    const display = getMapDisplay(document, sizeOf);
    const box = (id: string) => globalThis.document.querySelector<HTMLElement>(`[data-element-id="${id}"] .wc-mm-box`);
    for (const id of [...applied.current]) {
      if (display.follow.has(id)) continue;
      const el = box(id);
      if (el) el.style.transform = '';
      applied.current.delete(id);
    }
    for (const [id, offset] of display.follow) {
      const el = box(id);
      if (!el) continue;
      el.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
      applied.current.add(id);
    }
  }, [document]);
  useEffect(
    () => () => {
      for (const id of applied.current) {
        const el = globalThis.document.querySelector<HTMLElement>(`[data-element-id="${id}"] .wc-mm-box`);
        if (el) el.style.transform = '';
      }
      applied.current.clear();
    },
    [],
  );
}

export function EffectsLayer({ document, api }: CanvasLayerProps): JSX.Element {
  useGestureFlag();
  useFollowOffsets(document);
  // Files written by an older layout (or edited outside) may rest in the wrong place: fix once
  // on open, without an undo step. Everything else is normalised by afterChange on commit.
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (api.getDocument().elements.some(isMindNode)) relayoutNow(api, { history: 'skip' });
  }, [api]);
  return <DropPlaceholders document={document} />;
}
