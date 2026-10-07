/**
 * Workspace path safety (pure Node, no Electron import so it can be unit tested).
 *
 * Every RelPath coming from the renderer is POSIX, relative to the workspace root, without a
 * leading "/" ("" = root). Main never trusts it: `resolveLexical` rejects absolute paths,
 * NUL bytes, backslashes and ".." segments; `resolveExisting` / `resolveForCreate` then
 * realpath the target (or its parent) so symlinks cannot escape the root either.
 */

import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { IpcError } from './errors';

/** True when `candidate` (absolute) is the root itself or inside it. Both must be normalised. */
export function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  if (rel === '') return true;
  return !rel.startsWith('..') && !path.isAbsolute(rel) && rel.split(path.sep)[0] !== '..';
}

/** Normalises a RelPath ("a//b/" -> "a/b"); throws OUTSIDE_WORKSPACE on unsafe input. */
export function normalizeRel(rel: string): string {
  if (typeof rel !== 'string') throw new IpcError('OUTSIDE_WORKSPACE', 'Path must be a string');
  if (rel.includes('\0')) throw new IpcError('OUTSIDE_WORKSPACE', 'Path contains a NUL byte');
  if (rel.includes('\\')) throw new IpcError('OUTSIDE_WORKSPACE', 'Path must use "/" separators');
  if (rel.startsWith('/') || /^[a-zA-Z]:/.test(rel) || rel.startsWith('~')) {
    throw new IpcError('OUTSIDE_WORKSPACE', `Absolute paths are not allowed: ${rel}`);
  }
  const segments = rel.split('/').filter((s) => s !== '' && s !== '.');
  if (segments.some((s) => s === '..')) throw new IpcError('OUTSIDE_WORKSPACE', `Path escapes the workspace: ${rel}`);
  return segments.join('/');
}

/** Resolves a RelPath lexically against the (already realpath'd) root. */
export function resolveLexical(root: string, rel: string): string {
  const clean = normalizeRel(rel);
  const abs = path.resolve(root, ...clean.split('/').filter(Boolean));
  if (!isInside(root, abs)) throw new IpcError('OUTSIDE_WORKSPACE', `Path escapes the workspace: ${rel}`);
  return abs;
}

/** Converts an absolute path inside the root back to a POSIX RelPath. */
export function toRel(root: string, abs: string): string {
  const rel = path.relative(root, abs);
  return rel.split(path.sep).join('/');
}

/** Resolves an existing entry and verifies its real location (symlinks followed) is inside. */
export async function resolveExisting(root: string, rel: string): Promise<string> {
  const abs = resolveLexical(root, rel);
  let real: string;
  try {
    real = await realpath(abs);
  } catch {
    throw new IpcError('NOT_FOUND', `Not found: ${rel}`);
  }
  if (!isInside(root, real)) throw new IpcError('OUTSIDE_WORKSPACE', `Path resolves outside the workspace: ${rel}`);
  return abs;
}

/**
 * Resolves a path that may not exist yet: its parent folder must exist and really be inside
 * the root; the last segment must be a valid name.
 */
export async function resolveForCreate(root: string, rel: string): Promise<string> {
  const clean = normalizeRel(rel);
  if (clean === '') throw new IpcError('INVALID_NAME', 'Missing name');
  const parts = clean.split('/');
  const name = parts.pop() ?? '';
  assertValidName(name);
  const parent = await resolveExisting(root, parts.join('/'));
  return path.join(parent, name);
}

/** Bare file or folder name rules: not empty, no "/", "\\", NUL, no leading ".", not too long. */
export function validateName(name: string): string | null {
  if (typeof name !== 'string') return 'Name must be a string';
  const trimmed = name.trim();
  if (trimmed === '') return 'Name is empty';
  if (trimmed !== name) return 'Name has leading or trailing spaces';
  if (/[/\\\0:]/.test(name)) return 'Name contains a forbidden character';
  if (name.startsWith('.')) return 'Name starts with "."';
  if (Buffer.byteLength(name, 'utf8') > 255) return 'Name is too long';
  return null;
}

export function assertValidName(name: string): void {
  const problem = validateName(name);
  if (problem) throw new IpcError('INVALID_NAME', problem);
}

/** Splits "Name.wflow" into ["Name", ".wflow"]; dot-less names have an empty extension. */
export function splitName(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return [name, ''];
  return [name.slice(0, dot), name.slice(dot)];
}

/**
 * Returns the first free name among "<base><ext>", "<base> 2<ext>", "<base> 3<ext>"...
 * `exists` is checked case-insensitively by the caller when the file system is.
 */
export async function dedupeName(
  base: string,
  ext: string,
  exists: (name: string) => Promise<boolean>,
): Promise<string> {
  let candidate = `${base}${ext}`;
  for (let n = 2; await exists(candidate); n += 1) {
    if (n > 10_000) throw new IpcError('ALREADY_EXISTS', `No free name for ${base}${ext}`);
    candidate = `${base} ${n}${ext}`;
  }
  return candidate;
}

/**
 * Rewrites `p` when it is `from` or inside `from` (used for metadata after rename/move).
 * Returns null when `p` is unaffected.
 */
export function rewritePath(p: string, from: string, to: string): string | null {
  if (p === from) return to;
  if (from === '') return null;
  if (p.startsWith(`${from}/`)) return `${to}${p.slice(from.length)}`;
  return null;
}

/** True when `p` equals `ancestor` or is nested inside it (POSIX RelPaths). */
export function isSameOrDescendant(p: string, ancestor: string): boolean {
  if (ancestor === '') return true;
  return p === ancestor || p.startsWith(`${ancestor}/`);
}

export function parentOf(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i < 0 ? '' : rel.slice(0, i);
}

export function baseNameOf(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i < 0 ? rel : rel.slice(i + 1);
}

export function joinRel(dir: string, name: string): string {
  return dir === '' ? name : `${dir}/${name}`;
}

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Natural, case-insensitive name comparison used for the tree order. */
export const naturalCompare = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;
