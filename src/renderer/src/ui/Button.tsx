import { clsx } from 'clsx';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx('wc-button', `wc-button--${variant}`, `wc-button--${size}`, className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: string;
  /** Accessible label, also the tooltip text. */
  label: string;
  shortcut?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  noTooltip?: boolean;
  iconColor?: string;
}

const ICON_SIZE = { sm: 14, md: 16, lg: 18 } as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    shortcut,
    size = 'md',
    active,
    className,
    tooltipPlacement = 'bottom',
    noTooltip,
    iconColor,
    type = 'button',
    ...rest
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active}
      className={clsx('wc-icon-button', `wc-icon-button--${size}`, active && 'is-active', className)}
      {...rest}
    >
      <Icon name={icon} size={ICON_SIZE[size]} style={iconColor ? { color: iconColor } : undefined} />
    </button>
  );
  if (noTooltip) return button;
  return (
    <Tooltip label={label} shortcut={shortcut} placement={tooltipPlacement}>
      {button}
    </Tooltip>
  );
});
