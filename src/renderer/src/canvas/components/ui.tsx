/**
 * Small module-local UI primitives for canvas chrome (toolbar, context bar, menus). The shared
 * `ui/` module was empty when the canvas was built; these use the --wc-* tokens only.
 */

import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShortcutLabel } from '@renderer/core/shortcuts';
import { isPaletteColor } from '@renderer/core/palette';
import { PALETTE_ORDER, resolveColor } from '@renderer/core/palette';
import type { ColorRef, ThemeMode } from '@renderer/core/types';

/** Resolves a lucide-react component by its PascalCase name (tool / shortcut tables). */
export function iconByName(name: string | undefined): LucideIcon {
  const icons = Icons as unknown as Record<string, LucideIcon>;
  return (name && icons[name]) || Icons.Square;
}

export function Icon({ name, size = 18 }: { name: string | undefined; size?: number }): JSX.Element {
  const C = iconByName(name);
  return <C size={size} strokeWidth={1.75} aria-hidden />;
}

export interface IconButtonProps {
  icon: string;
  label: string;
  /** Command id whose shortcut is shown in the tooltip. */
  shortcutId?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: 'sm' | 'md';
  tooltipSide?: 'right' | 'top' | 'bottom' | 'left';
  children?: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, shortcutId, active, disabled, onClick, size = 'md', tooltipSide = 'right', children },
  ref,
) {
  const shortcut = useShortcutLabel(shortcutId ?? '');
  const tip = shortcut ? `${label}  ${shortcut}` : label;
  return (
    <button
      ref={ref}
      type="button"
      className={`wc-icon-btn wc-icon-btn--${size}${active ? ' is-active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={tip}
      data-tooltip-side={tooltipSide}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={(e) => e.preventDefault()}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : 18} />
      {children}
    </button>
  );
});

export function Divider({ vertical }: { vertical?: boolean }): JSX.Element {
  return <span className={vertical ? 'wc-divider wc-divider--v' : 'wc-divider'} aria-hidden />;
}

/** Popover anchored below (or beside) its trigger; closes on outside click and Escape. */
export function Popover({
  trigger,
  children,
  placement = 'bottom',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  placement?: 'bottom' | 'right' | 'top';
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <div className="wc-popover-anchor" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && <div className={`wc-popover wc-popover--${placement}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

/** Palette swatches (+ custom colours of the board). */
export function ColorSwatches({
  value,
  onChange,
  theme,
  role = 'fill',
  customColors = [],
  exclude = [],
}: {
  value: ColorRef | undefined;
  onChange: (c: ColorRef) => void;
  theme: ThemeMode;
  role?: 'fill' | 'soft' | 'stroke';
  customColors?: readonly `#${string}`[];
  exclude?: readonly ColorRef[];
}): JSX.Element {
  const { t } = useTranslation('canvas');
  const colors: ColorRef[] = [...PALETTE_ORDER.filter((c) => !exclude.includes(c)), ...customColors];
  return (
    <div className="wc-swatches" role="listbox">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="option"
          aria-selected={c === value}
          aria-label={isPaletteColor(c) ? t(`colors.${c}`) : t('contextBar.customColor')}
          title={isPaletteColor(c) ? t(`colors.${c}`) : c}
          className={`wc-swatch${c === value ? ' is-active' : ''}`}
          style={{ background: resolveColor(c, role, theme) }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

export function MenuItem({
  icon,
  label,
  shortcutId,
  active,
  onClick,
}: {
  icon?: string;
  label: string;
  shortcutId?: string;
  active?: boolean;
  onClick: () => void;
}): JSX.Element {
  const shortcut = useShortcutLabel(shortcutId ?? '');
  return (
    <button type="button" className={`wc-menu-item${active ? ' is-active' : ''}`} onClick={onClick}>
      {icon && <Icon name={icon} size={16} />}
      <span className="wc-menu-item__label">{label}</span>
      {shortcut && <kbd className="wc-menu-item__kbd">{shortcut}</kbd>}
    </button>
  );
}
