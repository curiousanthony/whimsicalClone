/** Standalone icon object (X): any lucide icon, tinted with a palette colour, aspect resize. */

import { useTranslation } from 'react-i18next';
import { Divider, IconButton } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { ContextBarProps, ElementDefinition, ElementRenderProps, IconElement } from '@renderer/core/types';
import { ColorControl } from '../controls';
import { lucideIcon } from '../iconLibrary';
import { normalizeIcon } from '../model';
import { requestIconPicker } from '../panels/iconPickerState';

function IconRender({ element, theme }: ElementRenderProps<IconElement>): JSX.Element {
  const Component = lucideIcon(element.icon);
  const color = element.color === 'slate' ? resolveColor('slate', 'text', theme) : resolveColor(element.color, 'fill', theme);
  if (!Component) return <div className="wc-board-icon wc-board-icon--missing" />;
  return (
    <div className="wc-board-icon" style={{ color }}>
      <Component width="100%" height="100%" strokeWidth={1.5} aria-hidden />
    </div>
  );
}

function IconContextBar({ elements, api }: ContextBarProps<IconElement>): JSX.Element {
  const { t } = useTranslation('board');
  const first = elements[0]!;
  return (
    <>
      <ColorControl elements={elements} api={api} role="fill" />
      <Divider vertical />
      <IconButton icon="Smile" label={t('icon.change')} size="sm" tooltipSide="top" onClick={() => requestIconPicker(api, { replaceId: first.id })} />
    </>
  );
}

export const iconDefinition: ElementDefinition<IconElement> = {
  type: 'icon',
  module: 'board',
  layer: 'box',
  Render: IconRender,
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  resize: 'aspect',
  rotatable: true,
  connectable: true,
  textEditable: false,
  styleProps: ['color'],
  ContextBar: IconContextBar,
  normalize: normalizeIcon,
};
