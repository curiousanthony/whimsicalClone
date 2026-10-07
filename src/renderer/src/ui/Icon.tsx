/**
 * Icon by lucide-react component name ("LayoutDashboard"). The whole lucide namespace is
 * looked up so aliases resolve too; unknown names render a neutral square.
 */

import * as Lucide from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

const registry = Lucide as unknown as Record<string, LucideIcon | undefined>;

export function getLucideIcon(name: string | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  const direct = registry[name];
  if (direct && (typeof direct === 'function' || typeof direct === 'object')) return direct;
  // Accept kebab-case names stored in documents ("layout-dashboard").
  const pascal = name.replace(/(^|-)([a-z0-9])/g, (_m, _d: string, c: string) => c.toUpperCase());
  return registry[pascal];
}

export interface IconProps extends Omit<LucideProps, 'ref'> {
  name: string | undefined;
  size?: number;
  style?: CSSProperties;
  fallback?: ReactNode;
}

export function Icon({ name, size = 16, strokeWidth = 1.75, fallback, ...rest }: IconProps): JSX.Element | null {
  const Component = getLucideIcon(name) ?? Lucide.Square;
  if (!getLucideIcon(name) && fallback !== undefined) return <>{fallback}</>;
  return <Component size={size} strokeWidth={strokeWidth} aria-hidden {...rest} />;
}
