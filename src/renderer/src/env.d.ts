/// <reference types="vite/client" />

import type { DesktopApi } from '@shared/ipc';

declare global {
  interface Window {
    /** Exposed by src/preload/index.ts via contextBridge. */
    api: DesktopApi;
  }
}

export {};
