/**
 * Runtime handlers of the wireframe module. Direct component keys (B, P, V, O, R, G, L, D, A)
 * are bound by the canvas from the tool table. The launchers E / F arm a pseudo tool whose
 * activation opens the matching panel; this also covers clicks on the toolbar buttons (the
 * canvas toolbar can only activate tools). Closing the panel without a pick returns to Select.
 */

import type { CanvasApi, ShortcutHandler } from '@renderer/core/types';
import { COMPONENTS_PANEL_ID, COMPONENTS_TOOL, FRAMES_PANEL_ID, FRAMES_TOOL } from './tools';

const SELECT_TOOL = 'canvas.selectTool';

interface ObservableEngine {
  store?: {
    subscribe(listener: (state: LauncherState, previous: LauncherState) => void): () => void;
  };
}

interface LauncherState {
  tool: string;
  panel: { id: string } | undefined;
}

const PANEL_OF: Readonly<Record<string, string>> = {
  [COMPONENTS_TOOL]: COMPONENTS_PANEL_ID,
  [FRAMES_TOOL]: FRAMES_PANEL_ID,
};

const wired = new WeakSet<object>();

/** Pure transition: what the launcher glue must do when the engine state changes. */
export function launcherAction(state: LauncherState, previous: LauncherState): { open?: string; reset?: boolean } {
  const panelId = PANEL_OF[state.tool];
  if (panelId && state.tool !== previous.tool && state.panel?.id !== panelId) return { open: panelId };
  const prevPanel = previous.panel?.id;
  if (prevPanel && !state.panel && PANEL_OF[state.tool] === prevPanel) return { reset: true };
  return {};
}

function wireLaunchers(api: CanvasApi): void {
  const engine = api as unknown as ObservableEngine;
  if (!engine.store || wired.has(api)) return;
  wired.add(api);
  engine.store.subscribe((state, previous) => {
    const action = launcherAction(state, previous);
    if (action.open) api.openPanel(action.open);
    else if (action.reset) api.setActiveTool(SELECT_TOOL);
  });
}

export function createWireframeCommands(api: CanvasApi): ShortcutHandler[] {
  wireLaunchers(api);
  const wireframeMode = () => api.getMode() === 'wireframe';
  return [
    { id: 'wireframe.components', run: () => api.setActiveTool(COMPONENTS_TOOL), isEnabled: wireframeMode },
    { id: 'wireframe.frames', run: () => api.setActiveTool(FRAMES_TOOL), isEnabled: wireframeMode },
  ];
}
