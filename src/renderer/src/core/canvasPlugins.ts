import { createContext, useContext } from 'react';
import type { CanvasPlugin } from './types';

/**
 * All canvas plugins, provided once by the app (app/canvasPlugins.ts) so the canvas engine
 * never imports editor modules directly (no import cycles, no shared file to edit).
 */
export const CanvasPluginsContext = createContext<readonly CanvasPlugin[]>([]);

export function useCanvasPlugins(): readonly CanvasPlugin[] {
  return useContext(CanvasPluginsContext);
}
