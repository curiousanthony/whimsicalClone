/**
 * Docs shortcuts (owner: docs module). Formatting keys are TipTap keymaps (dispatch
 * "native"); view-level commands (text size, nested-file navigation) go through the registry.
 * Whimsical input rules differ from CommonMark: *text* = bold, _text_ = italic, "_ " = checklist.
 */

import { shortcutTable } from '@renderer/core/shortcutTable';

export const docsShortcuts = shortcutTable('docs', [
  { id: 'docs.paragraph', keys: ['Mod+\\'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'Pilcrow' },
  { id: 'docs.bold', keys: ['Mod+B'], gestures: ['*text*'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'Bold' },
  { id: 'docs.italic', keys: ['Mod+I'], gestures: ['_text_'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'Italic' },
  { id: 'docs.strike', keys: ['Mod+Shift+X'], gestures: ['~text~'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'Strikethrough' },
  { id: 'docs.inlineCode', keys: ['Mod+Shift+K'], gestures: ['`text`'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'Code' },
  { id: 'docs.highlight', keys: ['Mod+Shift+H'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'Highlighter' },
  { id: 'docs.link', keys: ['Mod+Shift+U', 'Alt+K'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'Link' },
  { id: 'docs.mention', keys: [], gestures: ['@'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'AtSign' },
  { id: 'docs.changeBlockType', keys: ['Mod+/'], gestures: ['/'], scope: 'docs', group: 'docs', dispatch: 'native' },
  { id: 'docs.indent', keys: ['Tab'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'IndentIncrease' },
  { id: 'docs.outdent', keys: ['Shift+Tab'], scope: 'docs', group: 'docs', dispatch: 'native', icon: 'IndentDecrease' },
  { id: 'docs.codeLanguage', keys: ['Mod+Shift+K'], scope: 'docs', group: 'docs', dispatch: 'native' },
  { id: 'docs.selectMore', keys: ['Mod+A'], scope: 'docs', group: 'docs', dispatch: 'native', hidden: true },
  { id: 'docs.copyBlockLink', keys: ['Mod+Alt+Shift+C'], scope: 'docs', group: 'docs', allowInTextInput: true },
  { id: 'docs.copyAsMarkdown', keys: ['Mod+Shift+C'], scope: 'docs', group: 'docs', allowInTextInput: true },
  { id: 'docs.textSizeUp', keys: ['Mod+='], scope: 'docs', group: 'docs', allowInTextInput: true },
  { id: 'docs.textSizeDown', keys: ['Mod+-'], scope: 'docs', group: 'docs', allowInTextInput: true },
  { id: 'docs.openNested', keys: ['Mod+Enter'], scope: 'docs', group: 'docs', dispatch: 'native' },
  { id: 'docs.goToParent', keys: ['Mod+Escape'], scope: 'docs', group: 'docs', allowInTextInput: true },
  { id: 'docs.focusMode', keys: [], scope: 'docs', group: 'docs', icon: 'Maximize' },

  { id: 'docs.expandBlock', keys: ['Mod+Alt+]'], scope: 'docs', group: 'docsBlocks', dispatch: 'native' },
  { id: 'docs.collapseBlock', keys: ['Mod+Alt+['], scope: 'docs', group: 'docsBlocks', dispatch: 'native' },
  { id: 'docs.toggleDescendants', keys: [], gestures: ['Alt+Click'], scope: 'docs', group: 'docsBlocks', dispatch: 'native' },
  { id: 'docs.toggleSiblings', keys: [], gestures: ['Shift+Click'], scope: 'docs', group: 'docsBlocks', dispatch: 'native' },
  { id: 'docs.toggleAll', keys: [], gestures: ['Alt+Shift+Click'], scope: 'docs', group: 'docsBlocks', dispatch: 'native' },

  { id: 'docs.tableInsertRow', keys: ['Mod+Enter'], scope: 'docs', group: 'docsTables', dispatch: 'native' },
  { id: 'docs.tableInsertColumn', keys: ['Mod+Alt+Enter'], scope: 'docs', group: 'docsTables', dispatch: 'native' },
  { id: 'docs.tableRemoveRow', keys: ['Mod+Backspace'], scope: 'docs', group: 'docsTables', dispatch: 'native' },
  { id: 'docs.tableRemoveColumn', keys: ['Mod+Alt+Backspace'], scope: 'docs', group: 'docsTables', dispatch: 'native' },

  { id: 'docs.mdHeading1', keys: [], gestures: ['#+Space'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'Heading1' },
  { id: 'docs.mdHeading2', keys: [], gestures: ['##+Space'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'Heading2' },
  { id: 'docs.mdHeading3', keys: [], gestures: ['###+Space'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'Heading3' },
  { id: 'docs.mdBulletList', keys: ['Mod+Shift+8'], gestures: ['*+Space', '-+Space'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'List' },
  { id: 'docs.mdNumberedList', keys: ['Mod+Shift+7'], gestures: ['1.+Space'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'ListOrdered' },
  { id: 'docs.mdChecklist', keys: [], gestures: ['_+Space'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'ListTodo' },
  { id: 'docs.mdQuote', keys: [], gestures: ['>+Space'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'Quote' },
  { id: 'docs.mdLineDivider', keys: [], gestures: ['---'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'Minus' },
  { id: 'docs.mdSectionDivider', keys: [], gestures: ['***'], scope: 'docs', group: 'markdown', dispatch: 'native' },
  { id: 'docs.mdCodeBlock', keys: [], gestures: ['```'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'SquareCode' },
  { id: 'docs.mdEmoji', keys: [], gestures: [':name:'], scope: 'docs', group: 'markdown', dispatch: 'native', icon: 'Smile' },
]);
