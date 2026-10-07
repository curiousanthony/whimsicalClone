/**
 * Typed errors for IPC handlers. Handlers throw `IpcError`; `toResult` converts any thrown
 * value into an `IpcResult` so the error code survives the IPC boundary.
 */

import type { IpcErrorCode, IpcResult } from '@shared/ipc';

export class IpcError extends Error {
  constructor(
    readonly code: IpcErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'IpcError';
  }
}

/** Maps Node fs errors (ENOENT, EEXIST...) to IPC error codes. */
export function toIpcError(error: unknown): IpcError {
  if (error instanceof IpcError) return error;
  const err = error as NodeJS.ErrnoException | undefined;
  const message = err?.message ?? String(error);
  switch (err?.code) {
    case 'ENOENT':
    case 'ENOTDIR':
      return new IpcError('NOT_FOUND', message);
    case 'EEXIST':
    case 'ENOTEMPTY':
      return new IpcError('ALREADY_EXISTS', message);
    default:
      return new IpcError('IO_ERROR', message);
  }
}

/** Runs an async operation and wraps its outcome in an IpcResult. */
export async function toResult<T>(operation: () => Promise<T> | T): Promise<IpcResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    const e = toIpcError(error);
    return { ok: false, code: e.code, message: e.message };
  }
}
