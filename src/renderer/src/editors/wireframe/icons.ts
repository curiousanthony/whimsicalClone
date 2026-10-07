/**
 * lucide-react helpers for the wireframe module: stored icon names are kebab-case ("house",
 * "circle-user-round"), components are PascalCase exports. The index is built from the
 * already-bundled namespace (no per-icon dynamic chunks).
 */

import * as Icons from 'lucide-react';
import { icons as canonicalIcons } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const registry = Icons as unknown as Record<string, unknown>;

export function pascalToKebab(name: string): string {
  return (
    name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      // letter -> digit boundary ("Share2" -> "share-2"), but keep "3x3" together
      .replace(/([a-wyz]|(?<!\d)x)(\d)/g, '$1-$2')
      .toLowerCase()
  );
}

export function kebabToPascal(name: string): string {
  return name
    .split('-')
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join('');
}

function isIconExport(name: string, value: unknown): boolean {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) return false;
  if (name.startsWith('Lucide') || name.endsWith('Icon')) return false;
  return typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value);
}

let byName: Map<string, string> | undefined;
let names: string[] | undefined;

/** Canonical icons only (the `icons` map of lucide-react); deprecated aliases are not offered. */
function index(): Map<string, string> {
  if (!byName) {
    byName = new Map();
    for (const key of Object.keys(canonicalIcons)) byName.set(pascalToKebab(key), key);
  }
  return byName;
}

/** Every canonical icon as a kebab-case name, sorted. */
export function allIconNames(): string[] {
  if (!names) names = [...index().keys()].sort();
  return names;
}

/**
 * Component for a stored kebab-case name. Names of older files that are only aliases still
 * resolve through the full namespace.
 */
export function lucideByName(name: string | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  const canonical = index().get(name);
  if (canonical) return (canonicalIcons as unknown as Record<string, LucideIcon>)[canonical];
  const key = kebabToPascal(name);
  return isIconExport(key, registry[key]) ? (registry[key] as LucideIcon) : undefined;
}

/** Case-insensitive search; every query word must match. Whole-word matches rank first. */
export function searchIcons(query: string, all: readonly string[] = allIconNames(), limit = 120): string[] {
  const words = query
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (words.length === 0) return all.slice(0, limit);
  const scored: Array<{ name: string; score: number }> = [];
  for (const name of all) {
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
