/**
 * Board file format (.wboard / .wflow / .wmind / .wwire / .wdraw).
 *
 * - JSON, UTF-8, 2-space indentation, trailing newline; arrays of numbers (stroke points)
 *   are kept on one line so files stay readable and diff-friendly.
 * - Top-level key order is fixed: format, version, kind, settings, elements, then extras.
 * - `version` is an integer. Loading a newer version throws; older versions go through
 *   MIGRATIONS[n] (n -> n+1) in order.
 * - Unknown top-level keys are preserved in `extra`; unknown element types are preserved
 *   verbatim (the engine renders a placeholder) so newer files are never destroyed.
 */

import type { CanvasKind } from '@shared/fileKinds';
import {
  BOARD_FORMAT,
  BOARD_VERSION,
  type BoardDocument,
  type BoardElement,
  type BoardSettings,
  type CanvasMode,
  type JsonValue,
} from './types';

export class BoardFormatError extends Error {
  constructor(
    message: string,
    readonly code: 'INVALID_JSON' | 'NOT_A_BOARD' | 'NEWER_VERSION' | 'INVALID_STRUCTURE',
  ) {
    super(message);
    this.name = 'BoardFormatError';
  }
}

export function createDefaultSettings(mode: CanvasMode = 'diagram'): BoardSettings {
  return { mode, theme: 'whimsical', customColors: [], defaultStyles: {}, lastUsedStyles: {} };
}

export function createEmptyBoard(kind: CanvasKind, elements: BoardElement[] = []): BoardDocument {
  return {
    format: BOARD_FORMAT,
    version: BOARD_VERSION,
    kind,
    settings: createDefaultSettings(kind === 'wireframe' ? 'wireframe' : 'diagram'),
    elements,
  };
}

type RawDoc = Record<string, unknown>;

/** MIGRATIONS[n] upgrades a raw document from version n to n + 1. */
const MIGRATIONS: Record<number, (raw: RawDoc) => RawDoc> = {};

const KNOWN_KEYS = new Set(['format', 'version', 'kind', 'settings', 'elements', 'extra']);
const CANVAS_KINDS = new Set<CanvasKind>(['board', 'flowchart', 'mindmap', 'wireframe', 'draw']);

export function parseBoard(text: string, fallbackKind: CanvasKind): BoardDocument {
  if (text.trim() === '') return createEmptyBoard(fallbackKind);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new BoardFormatError(`Invalid JSON: ${(e as Error).message}`, 'INVALID_JSON');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BoardFormatError('Board file must contain a JSON object', 'NOT_A_BOARD');
  }
  let doc = raw as RawDoc;
  if (doc.format !== BOARD_FORMAT) throw new BoardFormatError(`Unknown format "${String(doc.format)}"`, 'NOT_A_BOARD');
  let version = typeof doc.version === 'number' ? doc.version : NaN;
  if (!Number.isInteger(version) || version < 1) {
    throw new BoardFormatError('Missing or invalid "version"', 'INVALID_STRUCTURE');
  }
  if (version > BOARD_VERSION) {
    throw new BoardFormatError(`File version ${version} is newer than supported ${BOARD_VERSION}`, 'NEWER_VERSION');
  }
  while (version < BOARD_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new BoardFormatError(`No migration from version ${version}`, 'INVALID_STRUCTURE');
    doc = migrate(doc);
    version += 1;
  }
  if (!Array.isArray(doc.elements)) throw new BoardFormatError('"elements" must be an array', 'INVALID_STRUCTURE');
  const kind = CANVAS_KINDS.has(doc.kind as CanvasKind) ? (doc.kind as CanvasKind) : fallbackKind;
  const settingsRaw = (doc.settings && typeof doc.settings === 'object' ? doc.settings : {}) as Partial<BoardSettings>;
  const settings: BoardSettings = { ...createDefaultSettings(), ...settingsRaw };

  const seen = new Set<string>();
  const elements: BoardElement[] = [];
  for (const el of doc.elements as unknown[]) {
    if (!el || typeof el !== 'object') continue;
    const e = el as BoardElement;
    if (typeof e.id !== 'string' || typeof e.type !== 'string' || seen.has(e.id)) continue;
    seen.add(e.id);
    elements.push(e);
  }

  const extra: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (!KNOWN_KEYS.has(key)) extra[key] = value as JsonValue;
  }
  if (doc.extra && typeof doc.extra === 'object') Object.assign(extra, doc.extra as Record<string, JsonValue>);

  const result: BoardDocument = { format: BOARD_FORMAT, version: BOARD_VERSION, kind, settings, elements };
  if (Object.keys(extra).length > 0) result.extra = extra;
  return result;
}

export function serializeBoard(doc: BoardDocument): string {
  const ordered: Record<string, unknown> = {
    format: doc.format,
    version: doc.version,
    kind: doc.kind,
    settings: doc.settings,
    elements: doc.elements,
  };
  if (doc.extra && Object.keys(doc.extra).length > 0) ordered.extra = doc.extra;
  return `${collapseNumberArrays(JSON.stringify(ordered, null, 2))}\n`;
}

/** Puts arrays that contain only numbers on a single line. */
export function collapseNumberArrays(json: string): string {
  return json.replace(/\[\s*(-?\d[\d.eE+-]*(?:\s*,\s*-?\d[\d.eE+-]*)*)\s*\]/g, (_m, inner: string) => {
    return `[${inner.split(/\s*,\s*/).join(', ')}]`;
  });
}
