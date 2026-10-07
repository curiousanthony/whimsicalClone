/** Free text object. Cannot be rotated; width is resizable, height follows the text. */

import { useTranslation } from 'react-i18next';
import { CanvasText, Divider } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { ContextBarProps, ElementDefinition, ElementRenderProps, TextElement } from '@renderer/core/types';
import { AlignControl, ColorControl, TextSizeControl } from '../controls';
import { normalizeText, TEXT_PADDING } from '../model';

export function textColorFor(element: Pick<TextElement, 'color'>, theme: 'light' | 'dark'): string {
  // Slate is the "ink" colour: it flips to white in dark mode like all canvas text.
  return element.color === 'slate' ? resolveColor('slate', 'text', theme) : resolveColor(element.color, 'fill', theme);
}

function TextRender({ element, editing, api, theme }: ElementRenderProps<TextElement>): JSX.Element {
  const { t } = useTranslation('board');
  return (
    <CanvasText
      element={element}
      text={element.text}
      editing={editing}
      api={api}
      textSize={element.textSize}
      align={element.textAlign}
      verticalAlign="top"
      padding={TEXT_PADDING}
      color={textColorFor(element, theme)}
      placeholder={t('text.placeholder')}
    />
  );
}

function TextContextBar({ elements, api }: ContextBarProps<TextElement>): JSX.Element {
  return (
    <>
      <ColorControl elements={elements} api={api} role="fill" />
      <Divider vertical />
      <TextSizeControl elements={elements} api={api} />
      <AlignControl elements={elements} api={api} />
    </>
  );
}

export const textDefinition: ElementDefinition<TextElement> = {
  type: 'text',
  module: 'board',
  layer: 'box',
  Render: TextRender,
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  resize: 'width',
  rotatable: false,
  connectable: true,
  textEditable: true,
  styleProps: ['color', 'textSize', 'textAlign'],
  getText: (e) => e.text,
  setText: (d, text) => {
    d.text = text;
  },
  // Setting a width by hand fixes it; height keeps following the text (autoSize.ts).
  applyResize: (d, next) => {
    d.x = next.x;
    d.y = next.y;
    if (next.w !== d.w) d.autoWidth = false;
    d.w = next.w;
    d.h = next.h;
  },
  ContextBar: TextContextBar,
  normalize: normalizeText,
};
