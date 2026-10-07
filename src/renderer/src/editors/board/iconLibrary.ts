/**
 * Lucide icon library for the icon tool: resolves stored kebab-case names to components and
 * lists searchable names. Uses the already-bundled `lucide-react` namespace (no per-icon
 * dynamic chunks), so names are derived from the component names with kebabToPascal's inverse.
 */

import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { kebabToPascal, pascalToKebab } from './model';

const registry = Icons as unknown as Record<string, unknown>;

/** Non-icon exports and aliases (HomeIcon, LucideHome) of lucide-react. */
function isIconExport(name: string, value: unknown): boolean {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) return false;
  if (name.startsWith('Lucide') || name.endsWith('Icon')) return false;
  return typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value);
}

let cachedNames: string[] | undefined;
/** kebab-case name -> lucide export key. Built from the registry because the mapping is not
 * reversible for names like "columns-3cog" (export "Columns3Cog"). */
let keyByName: Map<string, string> | undefined;

function index(): Map<string, string> {
  if (!keyByName) {
    keyByName = new Map();
    for (const [key, value] of Object.entries(registry)) if (isIconExport(key, value)) keyByName.set(pascalToKebab(key), key);
  }
  return keyByName;
}

/** Every available icon as a kebab-case name, sorted. */
export function allIconNames(): string[] {
  if (!cachedNames) cachedNames = [...index().keys()].sort();
  return cachedNames;
}

/** Component for a stored kebab-case name (undefined when the name is unknown). */
export function lucideIcon(name: string): LucideIcon | undefined {
  const key = index().get(name) ?? kebabToPascal(name);
  return isIconExport(key, registry[key]) ? (registry[key] as LucideIcon) : undefined;
}

/** Case-insensitive search over icon names; every query word must appear. Prefix matches first. */
export function searchIcons(query: string, names: readonly string[] = allIconNames(), limit = 200): string[] {
  const words = query.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return names.slice(0, limit);
  const scored: Array<{ name: string; score: number }> = [];
  for (const name of names) {
    const parts = name.split('-');
    let score = 0;
    let ok = true;
    for (const word of words) {
      if (parts.some((p) => p === word)) score += 3;
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
