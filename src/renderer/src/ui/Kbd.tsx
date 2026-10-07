import type { ReactNode } from 'react';
import { clsx } from 'clsx';

/** Keyboard shortcut label ("⌘K"). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <kbd className={clsx('wc-kbd', className)}>{children}</kbd>;
}
