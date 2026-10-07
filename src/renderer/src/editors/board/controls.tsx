/**
 * Shared context-bar controls for board objects: colour, text size and text alignment.
 * Built on the canvas chrome primitives (IconButton, Popover, ColorSwatches, MenuItem).
 */

import { useTranslation } from 'react-i18next';
import { ColorSwatches, IconButton, MenuItem, Popover, styleKeyOf } from '@renderer/canvas';
import { resolveColor, type ColorRole } from '@renderer/core/palette';
import type { BoardElement, CanvasApi, ColorRef, StylePreset, TextAlign, TextSize } from '@renderer/core/types';
import { TEXT_SIZES } from './model';

type Draftable = Record<string, unknown>;

/** Applies `patch` to every listed element (one undo step, coalesced per property bundle). */
export function patchElements(api: CanvasApi, elements: readonly BoardElement[], patch: Record<string, unknown>): void {
  const ids = new Set(elements.map((e) => e.id));
  api.update(
    (d) => {
      for (const el of d.elements) {
        if (ids.has(el.id)) Object.assign(el as unknown as Draftable, patch);
      }
    },
    { coalesceKey: `style:${[...ids].join(',')}:${Object.keys(patch).join(',')}` },
  );
  // New objects follow suit: remember the style for the element type.
  const first = elements[0];
  if (first) api.rememberStyle(styleKeyOf(first), patch as StylePreset);
}

export function ColorControl({
  elements,
  api,
  role = 'soft',
  property = 'color',
}: {
  elements: readonly BoardElement[];
  api: CanvasApi;
  role?: ColorRole;
  property?: string;
}): JSX.Element {
  const { t } = useTranslation('board');
  const current = (elements[0] as unknown as Draftable | undefined)?.[property] as ColorRef | undefined;
  const swatchRole = role === 'text' || role === 'onFill' ? 'fill' : role;
  return (
    <Popover
      trigger={({ toggle, open }) => (
        <button
          type="button"
          className={`wc-icon-btn wc-icon-btn--sm${open ? ' is-active' : ''}`}
          aria-label={t('contextBar.color')}
          data-tooltip={t('contextBar.color')}
          data-tooltip-side="top"
          onPointerDown={(e) => e.preventDefault()}
          onClick={toggle}
        >
          <span className="wc-board-color-dot" style={{ background: current ? resolveColor(current, swatchRole, api.theme) : 'transparent' }} />
        </button>
      )}
    >
      {(close) => (
        <ColorSwatches
          value={current}
          theme={api.theme}
          role={swatchRole}
          customColors={api.getDocument().settings.customColors}
          onChange={(color) => {
            patchElements(api, elements, { [property]: color });
            close();
          }}
        />
      )}
    </Popover>
  );
}

export function TextSizeControl({ elements, api }: { elements: readonly BoardElement[]; api: CanvasApi }): JSX.Element {
  const { t } = useTranslation('board');
  const current = (elements[0] as unknown as { textSize?: TextSize } | undefined)?.textSize ?? 'm';
  return (
    <Popover
      trigger={({ toggle, open }) => (
        <button
          type="button"
          className={`wc-icon-btn wc-icon-btn--sm wc-board-size-btn${open ? ' is-active' : ''}`}
          aria-label={t('contextBar.textSize')}
          data-tooltip={t('contextBar.textSize')}
          data-tooltip-side="top"
          onPointerDown={(e) => e.preventDefault()}
          onClick={toggle}
        >
          {current.toUpperCase()}
        </button>
      )}
    >
      {(close) => (
        <div className="wc-menu" onClick={close}>
          {TEXT_SIZES.map((size) => (
            <MenuItem key={size} label={t(`textSize.${size}`)} active={size === current} onClick={() => patchElements(api, elements, { textSize: size })} />
          ))}
        </div>
      )}
    </Popover>
  );
}

const ALIGN_ICONS: Record<TextAlign, string> = { left: 'AlignLeft', center: 'AlignCenter', right: 'AlignRight' };
const ALIGN_ORDER: readonly TextAlign[] = ['left', 'center', 'right'];

/** Cycles left -> centre -> right, like Whimsical's single alignment button. */
export function AlignControl({ elements, api }: { elements: readonly BoardElement[]; api: CanvasApi }): JSX.Element {
  const { t } = useTranslation('board');
  const current = (elements[0] as unknown as { textAlign?: TextAlign } | undefined)?.textAlign ?? 'left';
  const next = ALIGN_ORDER[(ALIGN_ORDER.indexOf(current) + 1) % ALIGN_ORDER.length] ?? 'left';
  return (
    <IconButton
      icon={ALIGN_ICONS[current]}
      label={t(`align.${next}`)}
      size="sm"
      tooltipSide="top"
      onClick={() => patchElements(api, elements, { textAlign: next })}
    />
  );
}
