/**
 * "Detect shapes" toggle. Stored in the app preferences (Preferences.detectShapes, SPEC 3.4) and
 * mirrored in a tiny module-level store so tools can read it synchronously.
 */

import type { EditorServices } from '@renderer/core/types';

let enabled = false;
let subscribed = false;
const listeners = new Set<() => void>();

export function getDetectShapes(): boolean {
  return enabled;
}

export function subscribeDetectShapes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(value: boolean): void {
  if (enabled === value) return;
  enabled = value;
  for (const l of [...listeners]) l();
}

/** Loads the stored value and follows changes made in other windows. Safe to call repeatedly. */
export function hydrateDetectShapes(api: EditorServices['api']): void {
  const prefs = api.prefs;
  if (!prefs) return;
  if (!subscribed) {
    subscribed = true;
    try {
      prefs.onChange?.((p) => apply(!!p.detectShapes));
    } catch {
      /* preferences bridge unavailable (tests, early boot) */
    }
  }
  try {
    void prefs
      .get()
      .then((p) => apply(!!p.detectShapes))
      .catch(() => undefined);
  } catch {
    /* ignore */
  }
}

/** Updates the toggle locally at once and persists it. */
export function setDetectShapes(api: EditorServices['api'], value: boolean): void {
  apply(value);
  try {
    void api.prefs?.set({ detectShapes: value }).catch(() => undefined);
  } catch {
    /* main may not implement prefs.set yet; the toggle still works for this session */
  }
}

/** Test helper. */
export function resetDetectShapesForTests(): void {
  enabled = false;
  subscribed = false;
  listeners.clear();
}
