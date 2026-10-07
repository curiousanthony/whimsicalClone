/**
 * Per-canvas UI state (zustand vanilla store). Document content is NOT here: the rendered
 * document comes from the DocumentController (`doc` mirrors controller.current).
 */

import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BoardDocument, CanvasMode, Point, Rect, Size, ThemeMode, Viewport } from '@renderer/core/types';
import type { SnapGuide } from '../snapping';

export interface EditingState {
  id: string;
  selectAll?: boolean;
  field?: string;
  /** Increments on every start so the editor remounts / refocuses. */
  seq: number;
}

export interface CanvasState {
  doc: BoardDocument;
  viewport: Viewport;
  /** Canvas element size in CSS pixels. */
  size: Size;
  selection: readonly string[];
  hoveredId: string | undefined;
  tool: string;
  mode: CanvasMode;
  theme: ThemeMode;
  editing: EditingState | undefined;
  /** World rect of the marquee or of a drag-to-create gesture. */
  marquee: Rect | undefined;
  creationRect: Rect | undefined;
  guides: SnapGuide[];
  /** Size label shown while resizing (world units). */
  resizeLabel: { w: number; h: number } | undefined;
  /** A pointer gesture is running (hides the context bar and quick-add buttons). */
  interacting: boolean;
  panning: boolean;
  spaceDown: boolean;
  quickAddHidden: boolean;
  panel: { id: string; anchor?: Point } | undefined;
  /** Bumped when a tool session overlay must re-render. */
  sessionSeq: number;
}

export type CanvasStore = StoreApi<CanvasState>;

export function createCanvasStore(initial: Pick<CanvasState, 'doc' | 'viewport' | 'tool' | 'mode' | 'theme'>): CanvasStore {
  return createStore<CanvasState>(() => ({
    ...initial,
    size: { w: 0, h: 0 },
    selection: [],
    hoveredId: undefined,
    editing: undefined,
    marquee: undefined,
    creationRect: undefined,
    guides: [],
    resizeLabel: undefined,
    interacting: false,
    panning: false,
    spaceDown: false,
    quickAddHidden: false,
    panel: undefined,
    sessionSeq: 0,
  }));
}
