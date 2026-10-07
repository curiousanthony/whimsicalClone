/** Internal React context giving canvas components access to their engine instance. */

import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { CanvasEngine } from './engine';
import type { CanvasState } from './store';

export const EngineContext = createContext<CanvasEngine | null>(null);

export function useEngine(): CanvasEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('Canvas component rendered outside a CanvasEditor');
  return engine;
}

/** Engine if inside a canvas (helpers used by element renderers degrade gracefully). */
export function useOptionalEngine(): CanvasEngine | null {
  return useContext(EngineContext);
}

export function useCanvasState<T>(selector: (s: CanvasState) => T): T {
  const engine = useEngine();
  return useStore(engine.store, selector);
}
