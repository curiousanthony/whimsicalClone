/** Sticky note: square, toned-down colour, auto-growing, full rich text. */

import { useTranslation } from 'react-i18next';
import { CanvasText, Divider, IconButton } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { ContextBarProps, ElementDefinition, ElementRenderProps, StickyElement } from '@renderer/core/types';
import { distributeSelectedStickies } from '../commands';
import { AlignControl, ColorControl, TextSizeControl } from '../controls';
import { normalizeSticky, STICKY_PADDING } from '../model';

function StickyRender({ element, editing, api, theme }: ElementRenderProps<StickyElement>): JSX.Element {
  const { t } = useTranslation('board');
  return (
    <div
      className="wc-board-sticky"
      style={{
        background: resolveColor(element.color, 'soft', theme),
        boxShadow: theme === 'dark' ? '0 1px 3px rgb(0 0 0 / 40%)' : '0 1px 2px rgb(41 55 68 / 14%), 0 3px 8px rgb(41 55 68 / 8%)',
      }}
    >
      <CanvasText
        element={element}
        text={element.text}
        editing={editing}
        api={api}
        textSize={element.textSize}
        align={element.textAlign}
        verticalAlign="top"
        padding={STICKY_PADDING}
        color={resolveColor(element.color, 'text', theme)}
        placeholder={t('sticky.placeholder')}
      />
    </div>
  );
}

function StickyContextBar({ elements, api }: ContextBarProps<StickyElement>): JSX.Element {
  const { t } = useTranslation('board');
  return (
    <>
      <ColorControl elements={elements} api={api} role="soft" />
      <Divider vertical />
      <TextSizeControl elements={elements} api={api} />
      <AlignControl elements={elements} api={api} />
      {elements.length > 1 && (
        <>
          <Divider vertical />
          <IconButton icon="LayoutGrid" label={t('commands.distributeGrid')} size="sm" tooltipSide="top" onClick={() => void distributeSelectedStickies(api)} />
        </>
      )}
    </>
  );
}

export const stickyDefinition: ElementDefinition<StickyElement> = {
  type: 'sticky',
  module: 'board',
  layer: 'box',
  Render: StickyRender,
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  resize: 'free',
  rotatable: true,
  connectable: true,
  textEditable: true,
  // Quick add (Alt+Arrow / hover +) clones the note next to it; stickies are not auto-connected.
  quickAdd: { connect: false },
  styleProps: ['color', 'textSize', 'textAlign'],
  getText: (e) => e.text,
  setText: (d, text) => {
    d.text = text;
  },
  // A manual resize turns auto-size off for that note (Whimsical).
  applyResize: (d, next) => {
    d.x = next.x;
    d.y = next.y;
    d.w = next.w;
    d.h = next.h;
    d.autoSize = false;
  },
  ContextBar: StickyContextBar,
  normalize: normalizeSticky,
};
