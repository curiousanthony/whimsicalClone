/** Image object: file picker / paste / drop import (engine), aspect-locked resize, caption. */

import { useTranslation } from 'react-i18next';
import { CanvasText, Divider, IconButton, nextRotation } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { ContextBarProps, ElementDefinition, ElementRenderProps, ImageElement } from '@renderer/core/types';

function ImageRender({ element, editing, api, theme }: ElementRenderProps<ImageElement>): JSX.Element {
  const { t } = useTranslation('board');
  const showCaption = !!element.showCaption || editing;
  return (
    <div className="wc-board-image">
      <img className="wc-board-image__img" src={element.src} alt={t('image.alt')} draggable={false} />
      {showCaption && (
        <div className="wc-board-image__caption">
          <CanvasText
            element={element}
            text={element.caption}
            editing={editing}
            api={api}
            textSize="s"
            align="center"
            verticalAlign="top"
            padding={4}
            color={resolveColor('slate', 'text', theme)}
            placeholder={t('image.captionPlaceholder')}
            paragraphsOnly
          />
        </div>
      )}
    </div>
  );
}

function ImageContextBar({ elements, api }: ContextBarProps<ImageElement>): JSX.Element {
  const { t } = useTranslation('board');
  const ids = new Set(elements.map((e) => e.id));
  const showing = elements.every((e) => e.showCaption);
  return (
    <>
      <IconButton
        icon="Captions"
        label={t('image.showCaption')}
        active={showing}
        size="sm"
        tooltipSide="top"
        onClick={() =>
          api.update((d) => {
            for (const el of d.elements) if (ids.has(el.id) && el.type === 'image') el.showCaption = !showing;
          })
        }
      />
      <Divider vertical />
      <IconButton
        icon="RotateCw"
        label={t('image.rotate')}
        size="sm"
        tooltipSide="top"
        onClick={() =>
          api.update((d) => {
            for (const el of d.elements) {
              if (!ids.has(el.id) || el.type !== 'image') continue;
              el.rotation = nextRotation(el.rotation);
            }
          })
        }
      />
    </>
  );
}

export const imageDefinition: ElementDefinition<ImageElement> = {
  type: 'image',
  module: 'board',
  layer: 'box',
  Render: ImageRender,
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  resize: 'aspect',
  rotatable: true,
  connectable: true,
  // Enter / double-click edits the caption.
  textEditable: true,
  getText: (e) => e.caption,
  setText: (d, text) => {
    d.caption = text;
    d.showCaption = true;
  },
  ContextBar: ImageContextBar,
  normalize: (e) => (e.src ? e : { ...e, src: '' }),
};
