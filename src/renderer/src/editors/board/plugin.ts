/**
 * General board objects: sticky notes, text, image, link, icon, section, table, code block.
 * .wboard is the general Whimsical board; all of these are also available in flowcharts, mind
 * maps and wireframes because every canvas loads every plugin.
 *
 * Reusable by other modules (document in the summary): the element definitions below and the
 * creation helpers exported from ./index.
 */

import type { CanvasPlugin } from '@renderer/core/types';
import { normalizeBoardObjects } from './autoSize';
import { createBoardCommands } from './commands';
import { codeDefinition } from './elements/code';
import { iconDefinition } from './elements/icon';
import { imageDefinition } from './elements/image';
import { linkDefinition } from './elements/link';
import { sectionDefinition } from './elements/section';
import { stickyDefinition } from './elements/sticky';
import { tableDefinition } from './elements/table';
import { textDefinition } from './elements/text';
import { IconPickerPanel } from './panels/IconPickerPanel';
import { ICON_PICKER_PANEL } from './panels/iconPickerState';
import { boardShortcuts } from './shortcuts';
import { boardTools } from './tools';
import './board.css';

export const boardElementDefinitions = [
  stickyDefinition,
  textDefinition,
  imageDefinition,
  linkDefinition,
  iconDefinition,
  sectionDefinition,
  tableDefinition,
  codeDefinition,
] as const;

export const boardPlugin: CanvasPlugin = {
  id: 'board',
  elements: boardElementDefinitions,
  tools: boardTools,
  shortcuts: boardShortcuts,
  createCommands: createBoardCommands,
  panels: { [ICON_PICKER_PANEL]: IconPickerPanel },
  afterChange: (next, previous, api) => normalizeBoardObjects(next, previous, (text, style, maxWidth) => api.measureText(text, style, maxWidth)),
};
