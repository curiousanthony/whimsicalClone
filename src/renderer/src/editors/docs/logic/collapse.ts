/**
 * Collapsible headings (research 03 section 5). Every heading collapses everything beneath it
 * until the next heading of the same or a higher level. Collapse state is per viewer and never
 * stored in the file. All functions are pure and work on the document's top-level blocks.
 */

export interface BlockInfo {
  /** Heading level 1..6, or null for any other block. */
  level: number | null;
  /** Plain text of the heading (used for the stable key). */
  text: string;
}

/** Stable keys "level:text:n" (n = occurrence), index-aligned with `blocks` (null for non headings). */
export function headingKeys(blocks: readonly BlockInfo[]): Array<string | null> {
  const seen = new Map<string, number>();
  return blocks.map((b) => {
    if (b.level === null) return null;
    const base = `${b.level}:${b.text.trim()}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}:${n}`;
  });
}

/** End (exclusive) of the section owned by the heading at `index`. */
export function sectionEnd(blocks: readonly BlockInfo[], index: number): number {
  const level = blocks[index]?.level;
  if (level === null || level === undefined) return index + 1;
  let i = index + 1;
  while (i < blocks.length) {
    const l = blocks[i]?.level;
    if (l !== null && l !== undefined && l <= level) break;
    i++;
  }
  return i;
}

/** Block indexes hidden by the collapsed headings (nested collapses are unioned). */
export function hiddenBlocks(blocks: readonly BlockInfo[], collapsed: ReadonlySet<string>): Set<number> {
  const keys = headingKeys(blocks);
  const hidden = new Set<number>();
  blocks.forEach((_b, index) => {
    const key = keys[index];
    if (key && collapsed.has(key) && !hidden.has(index)) {
      const end = sectionEnd(blocks, index);
      for (let i = index + 1; i < end; i++) hidden.add(i);
    }
  });
  return hidden;
}

export interface ToggleModifiers {
  /** Alt: the heading and all its descendants. */
  alt?: boolean;
  /** Shift: the heading and its siblings. */
  shift?: boolean;
}

function parentOf(blocks: readonly BlockInfo[], index: number): number {
  const level = blocks[index]?.level;
  if (level === null || level === undefined) return -1;
  for (let i = index - 1; i >= 0; i--) {
    const l = blocks[i]?.level;
    if (l !== null && l !== undefined && l < level) return i;
  }
  return -1;
}

function descendantHeadings(blocks: readonly BlockInfo[], index: number): number[] {
  const out: number[] = [];
  const end = sectionEnd(blocks, index);
  for (let i = index + 1; i < end; i++) if (blocks[i]?.level != null) out.push(i);
  return out;
}

/**
 * Heading indexes affected by a click on the toggle of `index`:
 * plain = itself; Alt = itself + descendants; Shift = itself + siblings; Alt+Shift = both.
 */
export function toggleTargets(blocks: readonly BlockInfo[], index: number, mods: ToggleModifiers = {}): number[] {
  const level = blocks[index]?.level;
  if (level === null || level === undefined) return [];
  let roots = [index];
  if (mods.shift) {
    const parent = parentOf(blocks, index);
    roots = [];
    blocks.forEach((b, i) => {
      if (b.level === level && parentOf(blocks, i) === parent) roots.push(i);
    });
  }
  const out = new Set<number>(roots);
  if (mods.alt) for (const r of roots) for (const d of descendantHeadings(blocks, r)) out.add(d);
  return [...out].sort((a, b) => a - b);
}

/** Applies a toggle: collapses all targets unless the clicked heading is already collapsed. */
export function toggleCollapsed(
  blocks: readonly BlockInfo[],
  collapsed: ReadonlySet<string>,
  index: number,
  mods: ToggleModifiers = {},
): Set<string> {
  const keys = headingKeys(blocks);
  const clickedKey = keys[index];
  if (!clickedKey) return new Set(collapsed);
  const expand = collapsed.has(clickedKey);
  const next = new Set(collapsed);
  for (const t of toggleTargets(blocks, index, mods)) {
    const key = keys[t];
    if (!key) continue;
    if (expand) next.delete(key);
    else next.add(key);
  }
  return next;
}

/** Expand block (⌘⌥]): reveals one level at a time. */
export function expandOneLevel(blocks: readonly BlockInfo[], collapsed: ReadonlySet<string>, index: number): Set<string> {
  const keys = headingKeys(blocks);
  const key = keys[index];
  const next = new Set(collapsed);
  if (!key) return next;
  if (next.has(key)) {
    next.delete(key);
    return next;
  }
  // Already open: open the shallowest collapsed descendants.
  const collapsedDesc = descendantHeadings(blocks, index).filter((d) => {
    const k = keys[d];
    return k !== null && k !== undefined && next.has(k);
  });
  if (collapsedDesc.length === 0) return next;
  const shallowest = Math.min(...collapsedDesc.map((d) => blocks[d]?.level ?? 6));
  for (const d of collapsedDesc) {
    if ((blocks[d]?.level ?? 6) === shallowest) next.delete(keys[d] as string);
  }
  return next;
}

/** Collapse block (⌘⌥[): hides all levels below the heading. */
export function collapseAllBelow(blocks: readonly BlockInfo[], collapsed: ReadonlySet<string>, index: number): Set<string> {
  const keys = headingKeys(blocks);
  const next = new Set(collapsed);
  for (const i of [index, ...descendantHeadings(blocks, index)]) {
    const k = keys[i];
    if (k) next.add(k);
  }
  return next;
}

/** Index of the heading that governs the block at `index` (itself if a heading), or -1. */
export function governingHeading(blocks: readonly BlockInfo[], index: number): number {
  for (let i = Math.min(index, blocks.length - 1); i >= 0; i--) {
    if (blocks[i]?.level != null) return i;
  }
  return -1;
}
