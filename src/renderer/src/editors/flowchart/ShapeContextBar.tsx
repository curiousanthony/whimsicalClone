/**
 * Contextual toolbar of diagram shapes (owner: flowchart): shape swap, colour, fill style,
 * text size / alignment, icon. Every control edits all selected shapes in one coalesced undo
 * step and records the style so new shapes follow suit.
 */

import { useTranslation } from 'react-i18next';
import { ColorSwatches, Divider, IconButton, MenuItem, Popover, Icon } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { CanvasApi, ContextBarProps, FillStyle, ShapeElement, ShapeKind, TextAlign, TextSize, VerticalAlign } from '@renderer/core/types';
import { FILL_STYLES, SHAPE_KINDS, SHAPE_SPECS, SHAPE_STYLE_PROPS, SHARED_STYLE_KEY, TEXT_SIZES, kebabToPascal, shapeStyleKey } from './shapes';
import { newSeed } from './shapeGeometry';

type Patch = Partial<ShapeElement>;

/** Curated lucide icons offered for "icon inside shape" (kebab-case names). */
export const SHAPE_ICONS: readonly string[] = [
  'user', 'users', 'database', 'server', 'cloud', 'globe', 'mail', 'phone', 'smartphone', 'laptop', 'monitor', 'lock',
  'key', 'shield-check', 'settings', 'cog', 'wrench', 'bell', 'bookmark', 'calendar', 'clock', 'credit-card', 'dollar-sign', 'shopping-cart',
  'package', 'truck', 'file-text', 'folder', 'image', 'camera', 'video', 'music', 'play', 'pause', 'check', 'x',
  'alert-triangle', 'info', 'help-circle', 'star', 'heart', 'thumbs-up', 'flag', 'map-pin', 'search', 'zap', 'code', 'terminal',
  'git-branch', 'cpu', 'wifi', 'link', 'send', 'download', 'upload', 'trash-2', 'edit', 'eye', 'home', 'lightbulb',
];

/** Applies a style patch to the selected shapes and remembers it for new shapes. */
export function applyShapeStyle(api: CanvasApi, ids: readonly string[], patch: Patch): void {
  const set = new Set(ids);
  const kinds = new Set<ShapeKind>();
  api.update(
    (d) => {
      for (const el of d.elements) {
        if (!set.has(el.id) || el.type !== 'shape') continue;
        Object.assign(el, patch);
        kinds.add(el.kind);
        if (patch.kind) {
          const spec = SHAPE_SPECS[patch.kind];
          if (spec.hasText && el.h < spec.minHeight) el.h = spec.minHeight;
          if (spec.seeded) el.seed = newSeed();
        }
      }
    },
    { coalesceKey: `style:${ids.join(',')}` },
  );
  const style: Record<string, string | boolean> = {};
  for (const p of SHAPE_STYLE_PROPS) {
    const v = patch[p];
    if (typeof v === 'string' || typeof v === 'boolean') style[p] = v;
  }
  if (Object.keys(style).length === 0) return;
  api.rememberStyle(SHARED_STYLE_KEY, style);
  for (const k of kinds) api.rememberStyle(shapeStyleKey(k), style);
}

function FillStyleGlyph({ style, color }: { style: FillStyle; color: string }): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="2"
        y="3"
        width="12"
        height="10"
        rx="2"
        fill={style === 'fill' ? color : style === 'none' ? 'none' : color}
        fillOpacity={style === 'fill' ? 1 : style === 'none' ? 0 : 0.25}
        stroke={style === 'fill' ? 'none' : color}
        strokeWidth="1.5"
        strokeDasharray={style === 'dashed' ? '3 2' : undefined}
      />
    </svg>
  );
}

const ALIGN_ICONS: Record<TextAlign, string> = { left: 'AlignLeft', center: 'AlignCenter', right: 'AlignRight' };
const VALIGN_ICONS: Record<VerticalAlign, string> = { top: 'AlignVerticalJustifyStart', middle: 'AlignVerticalJustifyCenter', bottom: 'AlignVerticalJustifyEnd' };

export function ShapeContextBar({ elements, api }: ContextBarProps<ShapeElement>): JSX.Element {
  const { t } = useTranslation('flowchart');
  const first = elements[0];
  const ids = elements.map((e) => e.id);
  if (!first) return <></>;
  const apply = (patch: Patch) => applyShapeStyle(api, ids, patch);
  const sameKind = elements.every((e) => e.kind === first.kind);
  const allLines = elements.every((e) => e.kind === 'line' || e.kind === 'bracket');
  const textual = elements.some((e) => SHAPE_SPECS[e.kind].hasText);
  const dotColor = resolveColor(first.color, 'fill', api.theme);

  return (
    <>
      <Popover
        trigger={({ toggle, open }) => (
          <IconButton icon={SHAPE_SPECS[first.kind].icon} label={t('contextBar.shape')} onClick={toggle} active={open} size="sm" tooltipSide="top" />
        )}
      >
        {(close) => (
          <div className="wc-menu">
            {SHAPE_KINDS.map((kind) => (
              <MenuItem
                key={kind}
                icon={SHAPE_SPECS[kind].icon}
                label={t(`commands.${kind}`)}
                active={sameKind && first.kind === kind}
                onClick={() => {
                  apply({ kind });
                  close();
                }}
              />
            ))}
          </div>
        )}
      </Popover>
      <Divider vertical />
      <Popover
        trigger={({ toggle, open }) => (
          <button type="button" className="wc-color-btn" aria-label={t('contextBar.color')} data-tooltip={t('contextBar.color')} data-tooltip-side="top" onClick={toggle} aria-pressed={open}>
            <span className="wc-color-btn__dot" style={{ background: dotColor }} />
          </button>
        )}
      >
        {(close) => (
          <ColorSwatches
            value={first.color}
            theme={api.theme}
            customColors={api.getDocument().settings.customColors}
            onChange={(color) => {
              apply({ color });
              close();
            }}
          />
        )}
      </Popover>
      {!allLines && (
        <>
          {FILL_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              className={`wc-icon-btn wc-icon-btn--sm${first.fillStyle === style ? ' is-active' : ''}`}
              aria-label={t(`fillStyle.${style}`)}
              aria-pressed={first.fillStyle === style}
              data-tooltip={t(`fillStyle.${style}`)}
              data-tooltip-side="top"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => apply({ fillStyle: style })}
            >
              <FillStyleGlyph style={style} color={dotColor} />
            </button>
          ))}
        </>
      )}
      {allLines && (
        <IconButton
          icon="Ellipsis"
          label={first.dashed ? t('contextBar.solidLine') : t('contextBar.dashedLine')}
          active={!!first.dashed}
          onClick={() => apply({ dashed: !first.dashed })}
          size="sm"
          tooltipSide="top"
        />
      )}
      {textual && (
        <>
          <Divider vertical />
          <Popover
            trigger={({ toggle, open }) => (
              <IconButton icon="Baseline" label={t('contextBar.textSize')} onClick={toggle} active={open} size="sm" tooltipSide="top" />
            )}
          >
            {(close) => (
              <div className="wc-menu">
                {TEXT_SIZES.map((size: TextSize) => (
                  <MenuItem
                    key={size}
                    label={t(`textSize.${size}`)}
                    active={first.textSize === size}
                    onClick={() => {
                      apply({ textSize: size });
                      close();
                    }}
                  />
                ))}
              </div>
            )}
          </Popover>
          <Popover
            trigger={({ toggle, open }) => (
              <IconButton icon={ALIGN_ICONS[first.textAlign]} label={t('contextBar.textAlign')} onClick={toggle} active={open} size="sm" tooltipSide="top" />
            )}
          >
            {(close) => (
              <div className="wc-menu">
                {(Object.keys(ALIGN_ICONS) as TextAlign[]).map((align) => (
                  <MenuItem
                    key={align}
                    icon={ALIGN_ICONS[align]}
                    label={t(`align.${align}`)}
                    active={first.textAlign === align}
                    onClick={() => {
                      apply({ textAlign: align });
                      close();
                    }}
                  />
                ))}
                {(Object.keys(VALIGN_ICONS) as VerticalAlign[]).map((v) => (
                  <MenuItem
                    key={v}
                    icon={VALIGN_ICONS[v]}
                    label={t(`verticalAlign.${v}`)}
                    active={first.verticalAlign === v}
                    onClick={() => {
                      apply({ verticalAlign: v });
                      close();
                    }}
                  />
                ))}
              </div>
            )}
          </Popover>
          <IconPicker elements={elements} api={api} />
        </>
      )}
    </>
  );
}

function IconPicker({ elements, api }: ContextBarProps<ShapeElement>): JSX.Element {
  const { t } = useTranslation('flowchart');
  const first = elements[0]!;
  const ids = elements.map((e) => e.id);
  const setIcon = (icon: ShapeElement['icon']) => {
    const set = new Set(ids);
    api.update((d) => {
      for (const el of d.elements) {
        if (!set.has(el.id) || el.type !== 'shape') continue;
        if (icon) el.icon = icon;
        else delete el.icon;
      }
    });
  };
  return (
    <Popover
      trigger={({ toggle, open }) => (
        <IconButton icon="Smile" label={t('contextBar.icon')} onClick={toggle} active={open || !!first.icon} size="sm" tooltipSide="top" />
      )}
    >
      {(close) => (
        <div className="wc-fc-iconpicker">
          <div className="wc-fc-iconpicker__placement">
            {(['top', 'left', 'right'] as const).map((placement) => (
              <button
                key={placement}
                type="button"
                className={`wc-icon-btn wc-icon-btn--sm${first.icon?.placement === placement ? ' is-active' : ''}`}
                aria-label={t(`iconPlacement.${placement}`)}
                data-tooltip={t(`iconPlacement.${placement}`)}
                data-tooltip-side="top"
                disabled={!first.icon}
                onClick={() => first.icon && setIcon({ name: first.icon.name, placement })}
              >
                <Icon name={placement === 'top' ? 'PanelTop' : placement === 'left' ? 'PanelLeft' : 'PanelRight'} size={16} />
              </button>
            ))}
            <button type="button" className="wc-icon-btn wc-icon-btn--sm" aria-label={t('contextBar.removeIcon')} data-tooltip={t('contextBar.removeIcon')} data-tooltip-side="top" disabled={!first.icon} onClick={() => { setIcon(undefined); close(); }}>
              <Icon name="Trash2" size={16} />
            </button>
          </div>
          <div className="wc-fc-iconpicker__grid" role="listbox" aria-label={t('contextBar.icon')}>
            {SHAPE_ICONS.map((name) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={first.icon?.name === name}
                aria-label={name}
                title={name}
                className={`wc-icon-btn wc-icon-btn--sm${first.icon?.name === name ? ' is-active' : ''}`}
                onClick={() => {
                  setIcon({ name, placement: first.icon?.placement ?? 'top' });
                  close();
                }}
              >
                <Icon name={kebabToPascal(name)} size={16} />
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
