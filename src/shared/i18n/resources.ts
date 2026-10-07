/**
 * i18n resources shared by main (native dialogs fallback) and renderer.
 *
 * - English is the source of truth and is imported statically so key types are inferred
 *   (see renderer/src/i18n/i18next.d.ts).
 * - Every other language is discovered automatically: drop `locales/<lng>/<ns>.json` files
 *   (same namespaces, same key structure) and they are picked up at build time.
 * - Missing or empty-string translations fall back to English (`returnEmptyString: false`).
 *
 * One namespace per module; each namespace file is owned by exactly one module (see SPEC).
 */

import common from './locales/en/common.json';
import shell from './locales/en/shell.json';
import menu from './locales/en/menu.json';
import canvas from './locales/en/canvas.json';
import flowchart from './locales/en/flowchart.json';
import mindmap from './locales/en/mindmap.json';
import wireframe from './locales/en/wireframe.json';
import board from './locales/en/board.json';
import draw from './locales/en/draw.json';
import docs from './locales/en/docs.json';

export const NAMESPACES = [
  'common',
  'shell',
  'menu',
  'canvas',
  'flowchart',
  'mindmap',
  'wireframe',
  'board',
  'draw',
  'docs',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NS: Namespace = 'common';
export const FALLBACK_LNG = 'en';

export const enResources = {
  common,
  shell,
  menu,
  canvas,
  flowchart,
  mindmap,
  wireframe,
  board,
  draw,
  docs,
} as const;

type JsonTree = { [key: string]: string | JsonTree };
export type LocaleResources = Record<string, Partial<Record<Namespace, JsonTree>>>;

const discovered = import.meta.glob<{ default: JsonTree }>('./locales/*/*.json', { eager: true });

function buildResources(): LocaleResources {
  const out: LocaleResources = { en: enResources as unknown as Partial<Record<Namespace, JsonTree>> };
  for (const [file, mod] of Object.entries(discovered)) {
    const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(file);
    if (!match) continue;
    const lng = match[1]!;
    const ns = match[2]! as Namespace;
    if (lng === 'en' || !NAMESPACES.includes(ns)) continue;
    (out[lng] ??= {})[ns] = mod.default;
  }
  return out;
}

export const resources: LocaleResources = buildResources();

/** Languages that ship at least one namespace file. */
export const AVAILABLE_LANGUAGES: string[] = Object.keys(resources);

/** Picks the best available language for a preference / system locale such as "fr-FR". */
export function resolveLanguage(preference: string, systemLocale: string): string {
  const wanted = preference === 'system' ? systemLocale : preference;
  const base = wanted.toLowerCase().split(/[-_]/)[0] ?? FALLBACK_LNG;
  return AVAILABLE_LANGUAGES.includes(base) ? base : FALLBACK_LNG;
}
