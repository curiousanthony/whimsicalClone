/**
 * Mind-map module: `mindmapNode` element, tidy-tree layout (afterChange), keyboard model,
 * collapse, drag re-parenting, branch lines. A `.wmind` file is a board seeded with one root
 * node; every board can hold mind maps (`M`).
 */

import type { CanvasPlugin } from '@renderer/core/types';
import { sizeOf } from './actions';
import { normalizeMindMaps } from './afterChange';
import { createMindmapCommands } from './commands';
import { mindNodeDefinition } from './definition';
import { BranchLayer, EffectsLayer } from './layers';
import { mindmapPanels } from './panels';
import { mindmapShortcuts } from './shortcuts';
import { mindmapTools } from './tools';

export const mindmapPlugin: CanvasPlugin = {
  id: 'mindmap',
  elements: [mindNodeDefinition],
  tools: mindmapTools,
  shortcuts: mindmapShortcuts,
  createCommands: createMindmapCommands,
  layers: { below: BranchLayer, above: EffectsLayer },
  panels: mindmapPanels,
  afterChange: (next, previous) => normalizeMindMaps(next, previous, sizeOf),
};
