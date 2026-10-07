/** Pure filtering of the launcher menus (kept free of React for unit tests). */

import type { DeviceKind } from '@renderer/core/types';
import type { LauncherEntry } from './registry';

export type Resolve = (key: string) => string;

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Entries whose label or keywords contain every query word; fixed order is preserved. */
export function filterLauncher(entries: readonly LauncherEntry[], query: string, resolve: Resolve): LauncherEntry[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];
  return entries.filter((entry) => {
    const haystack = normalise(`${resolve(entry.labelKey)} ${resolve(entry.keywordsKey)}`);
    return words.every((w) => haystack.includes(w));
  });
}

/** Devices whose name (or kind) contains the query; fixed order is preserved. */
export function filterDevices(devices: readonly DeviceKind[], query: string, resolve: Resolve): DeviceKind[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...devices];
  return devices.filter((device) => {
    const haystack = normalise(
      `${resolve(`wireframe:frames.${device}`)} ${resolve(`wireframe:keywords.frame-${device}`)}`,
    );
    return words.every((w) => haystack.includes(w));
  });
}
