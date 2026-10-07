/** Small form controls: segmented control, switch, select, text field. */

import { clsx } from 'clsx';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <div className="wc-segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={clsx('wc-segmented__option', o.value === value && 'is-selected')}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={clsx('wc-switch', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    >
      <span className="wc-switch__thumb" />
    </button>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <select className="wc-select" aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { icon, trailing, className, ...rest },
  ref,
) {
  return (
    <label className={clsx('wc-textfield', className)}>
      {icon && <Icon name={icon} size={16} className="wc-textfield__icon" />}
      <input ref={ref} spellCheck={false} autoComplete="off" {...rest} />
      {trailing}
    </label>
  );
});
