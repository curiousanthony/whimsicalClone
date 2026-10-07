/**
 * Mind-map creation tool: `M`, then click (or Enter for the viewport centre) places a root
 * node and starts editing it. The tool id equals its shortcut id so the canvas binds `M`.
 */

import type { ToolDefinition } from '@renderer/core/types';
import { createMapAt } from './commands';

export const mindmapTools: ToolDefinition[] = [
  {
    id: 'mindmap.addRoot',
    module: 'mindmap',
    labelKey: 'mindmap:commands.addRoot',
    icon: 'Network',
    shortcutId: 'mindmap.addRoot',
    group: 'mindmap',
    modes: ['diagram'],
    keywordsKey: 'mindmap:keywords.addRoot',
    cursor: 'crosshair',
    editAfterCreate: true,
    create: (api, at) => [createMapAt(api, at)],
  },
];
