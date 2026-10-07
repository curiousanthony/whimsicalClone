/**
 * Content-addressed workspace assets (`<root>/.whimsical/assets/<sha256-16>.<ext>`) and the
 * `wsasset://` protocol that serves them. Pure helpers are exported for tests.
 */

import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ASSET_PROTOCOL, WORKSPACE_ASSETS_DIR } from '@shared/fileKinds';
import type { AssetRef } from '@shared/ipc';
import { IpcError } from './errors';
import { sha256 } from './paths';
import { atomicWrite } from './workspaceFs';

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  txt: 'text/plain',
  json: 'application/json',
};

export const ASSET_NAME_RE = /^[0-9a-f]{16}\.[a-z0-9]{1,8}$/;

export function mimeForExt(ext: string): string {
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/** Lower-cased, sanitised extension of an original file name ("bin" when unknown). */
export function assetExtension(name: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  const ext = match?.[1]?.toLowerCase() ?? 'bin';
  return ext === 'jpeg' ? 'jpg' : ext;
}

export function assetFileName(bytes: Uint8Array, name: string): string {
  return `${sha256(bytes).slice(0, 16)}.${assetExtension(name)}`;
}

export type ImageSizeReader = (bytes: Uint8Array) => { width: number; height: number } | null;

/** Stores bytes in the workspace's assets folder (if absent) and returns the asset ref. */
export async function storeAsset(
  root: string,
  name: string,
  bytes: Uint8Array,
  readSize?: ImageSizeReader,
): Promise<AssetRef> {
  if (bytes.byteLength === 0) throw new IpcError('IO_ERROR', 'Empty file');
  const fileName = assetFileName(bytes, name);
  const abs = path.join(root, ...WORKSPACE_ASSETS_DIR.split('/'), fileName);
  try {
    await access(abs, constants.F_OK);
  } catch {
    await atomicWrite(abs, bytes);
  }
  const ext = fileName.slice(fileName.indexOf('.') + 1);
  const ref: AssetRef = { url: `${ASSET_PROTOCOL}://${fileName}`, mime: mimeForExt(ext) };
  if (ref.mime.startsWith('image/') && readSize) {
    const size = readSize(bytes);
    if (size && size.width > 0 && size.height > 0) {
      ref.width = size.width;
      ref.height = size.height;
    }
  }
  return ref;
}

export async function storeAssetFromFile(root: string, absPath: string, readSize?: ImageSizeReader): Promise<AssetRef> {
  if (typeof absPath !== 'string' || !path.isAbsolute(absPath))
    throw new IpcError('NOT_FOUND', 'Path must be absolute');
  const bytes = await readFile(absPath);
  return storeAsset(
    root,
    path.basename(absPath),
    new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    readSize,
  );
}

/**
 * Resolves a `wsasset://<name>` request against the open workspaces' asset folders.
 * Returns a file URL or null. Only strict content-addressed names are accepted.
 */
export async function resolveAssetRequest(requestUrl: string, roots: Iterable<string>): Promise<string | null> {
  let name: string;
  try {
    const url = new URL(requestUrl);
    name = (url.host || url.pathname.replace(/^\/+/, '')).toLowerCase();
  } catch {
    return null;
  }
  if (!ASSET_NAME_RE.test(name)) return null;
  for (const root of roots) {
    const abs = path.join(root, ...WORKSPACE_ASSETS_DIR.split('/'), name);
    try {
      await access(abs, constants.R_OK);
      return pathToFileURL(abs).toString();
    } catch {
      // try next workspace
    }
  }
  return null;
}
