/**
 * General board object shortcuts (owner: board module): sticky notes, text, image, link,
 * icon, section, table, code block. N works in all board modes (Whimsical).
 */

import { shortcutTable } from '@renderer/core/shortcutTable';

export const boardShortcuts = shortcutTable('board', [
  { id: 'board.sticky', keys: ['N'], scope: 'canvas', group: 'sticky', icon: 'StickyNote' },
  { id: 'board.text', keys: ['T'], scope: 'canvas', group: 'tools', icon: 'Type' },
  { id: 'board.image', keys: ['I'], scope: 'canvas.diagram', group: 'tools', icon: 'Image' },
  { id: 'board.link', keys: ['K'], scope: 'canvas', group: 'tools', icon: 'Link' },
  { id: 'board.icon', keys: ['X'], scope: 'canvas', group: 'tools', icon: 'Smile' },
  { id: 'board.section', keys: ['.'], scope: 'canvas', group: 'tools', icon: 'SquareDashed' },
  { id: 'board.table', keys: ['E'], scope: 'canvas.diagram', group: 'tools', icon: 'Table' },
  { id: 'board.codeBlock', keys: [], scope: 'canvas', group: 'tools', icon: 'CodeXml' },
  { id: 'board.distributeGrid', keys: [], scope: 'canvas', group: 'sticky', icon: 'LayoutGrid' },
  { id: 'board.pasteAsStickies', keys: [], scope: 'canvas', group: 'sticky', icon: 'ClipboardPaste' },
]);
