/** Public API of the docs module (Markdown notes). Imported by app/ only. */

import { lazy } from 'react';
import { getFileKindInfo } from '@shared/fileKinds';
import type { DocContent, EditorPlugin } from '@renderer/core/types';
import { docsShortcuts } from './shortcuts';

const info = getFileKindInfo('doc');

export const docsEditor: EditorPlugin<DocContent> = {
  kind: 'doc',
  extensions: [info.extension, '.markdown'],
  labelKey: `common:${info.labelKey}`,
  newFileNameKey: 'common:newFile.doc',
  icon: info.icon,
  historyMode: 'editor',
  createEmpty: () => '',
  parse: (text) => text.replace(/\r\n/g, '\n'),
  serialize: (content) => (content.endsWith('\n') || content === '' ? content : `${content}\n`),
  shortcuts: docsShortcuts,
  component: lazy(() => import('./DocsEditor')),
};
