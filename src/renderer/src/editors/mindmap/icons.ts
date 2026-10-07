/**
 * Lucide icon lookup for node icons. Icons are stored by kebab-case name ("circle-user-round")
 * and resolved against the already bundled `lucide-react` namespace.
 */

import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const registry = Icons as unknown as Record<string, unknown>;

export function kebabToPascal(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

export function pascalToKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])(\d)/g, '$1-$2')
    .replace(/(\d)([A-Za-z])/g, '$1-$2')
    .toLowerCase();
}

function isIconExport(name: string, value: unknown): boolean {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) return false;
  if (name.startsWith('Lucide') || name.endsWith('Icon')) return false;
  return typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value);
}

let cachedNames: string[] | undefined;

/** Every available icon as a kebab-case name, sorted. */
export function allIconNames(): string[] {
  if (!cachedNames) {
    const names = new Set<string>();
    for (const [name, value] of Object.entries(registry)) if (isIconExport(name, value)) names.add(pascalToKebab(name));
    cachedNames = [...names].sort();
  }
  return cachedNames;
}

/** Component for a stored kebab-case name, undefined when unknown. */
export function lucideIcon(name: string): LucideIcon | undefined {
  const pascal = kebabToPascal(name);
  const value = registry[pascal];
  return isIconExport(pascal, value) ? (value as LucideIcon) : undefined;
}

/** Case-insensitive search; every query word must appear; whole-word matches rank first. */
export function searchIcons(query: string, names: readonly string[] = allIconNames(), limit = 200): string[] {
  const words = query.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return names.slice(0, limit);
  const scored: Array<{ name: string; score: number }> = [];
  for (const name of names) {
    const parts = name.split('-');
    let score = 0;
    let ok = true;
    for (const word of words) {
      if (parts.includes(word)) score += 3;
      else if (parts.some((p) => p.startsWith(word))) score += 2;
      else if (name.includes(word)) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (ok) scored.push({ name, score });
  }
  scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((s) => s.name);
}
